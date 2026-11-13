import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { writeSecureFile } from '../../shared/secure-file'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import { pinnedKnownHostsFile } from '../ssh/pinned-host-keys'
import {
  FORK_HOME_FOLDER_NAME,
  FORK_PRODUCT_NAME,
  LEGACY_HOME_FOLDER_NAME
} from '../../shared/fork-identity'

export const MIRROR_SSH_HOST = 'orca-cloud-mirror'

/**
 * Where cloud mirrors live; a visible folder, so the person can open one in any editor. A profile
 * that already has mirrors in the old folder keeps them there: workspaces record the full path.
 */
export function cloudMirrorsRoot(): string {
  const root = join(homedir(), FORK_HOME_FOLDER_NAME, 'cloud-mirrors')
  const legacyRoot = join(homedir(), LEGACY_HOME_FOLDER_NAME, 'cloud-mirrors')
  return !existsSync(root) && existsSync(legacyRoot) ? legacyRoot : root
}

export type SandboxTarget = {
  runtimeId: string
  host: string
  username: string
  identityFile: string
  proxyCommand: string
  projectRoot: string
}

/**
 * The workspace's own SSH settings as a private ssh config: its key, its ProxyCommand and its
 * pinned host key (strict). rsync and ssh read it with -F, so nothing touches ~/.ssh.
 */
export function writeMirrorSshConfig(target: SandboxTarget): string {
  const pinned = pinnedKnownHostsFile({
    owner: { type: 'on-demand-runtime', runtimeId: target.runtimeId }
  })
  if (!pinned) {
    throw new Error('This cloud workspace has no pinned host key; open it once to reconnect.')
  }
  // Paths go into ssh_config inside double quotes; a quote or newline would end the value early.
  for (const value of [pinned, target.identityFile, target.host, target.username]) {
    if (/["\n\r]/.test(value)) {
      throw new Error(
        `A cloud workspace path contains a quote or newline; ${FORK_PRODUCT_NAME} will not use it.`
      )
    }
  }
  if (/[\n\r]/.test(target.proxyCommand)) {
    throw new Error('The cloud workspace connection is malformed.')
  }
  const dir = join(cloudMirrorsRoot(), '.config')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = join(dir, `${target.runtimeId}.ssh_config`)
  writeSecureFile(
    file,
    [
      `Host ${MIRROR_SSH_HOST}`,
      `  HostName ${target.host}`,
      `  HostKeyAlias ${target.host}`,
      `  User ${target.username}`,
      `  IdentityFile "${target.identityFile}"`,
      '  IdentitiesOnly yes',
      `  ProxyCommand ${target.proxyCommand}`,
      `  UserKnownHostsFile "${pinned}"`,
      '  GlobalKnownHostsFile /dev/null',
      '  StrictHostKeyChecking yes',
      '  BatchMode yes',
      '  ConnectTimeout 20',
      ''
    ].join('\n')
  )
  return file
}

export async function sshRun(
  config: string,
  command: string,
  maxOutputBytes = 1024 * 1024
): Promise<string> {
  const result = await runProcess({
    program: resolveSelectedLocalCommand('ssh', { env: process.env }),
    args: ['-F', config, MIRROR_SSH_HOST, command],
    env: process.env,
    timeoutMs: 60_000,
    maxOutputBytes
  })
  if (result.code !== 0) {
    throw new Error(`ssh failed: ${result.stderr.trim().split('\n').slice(-2).join(' ')}`)
  }
  return result.stdout
}

export type RemoteEntry = { path: string; size: number; kind: 'file' | 'link' | 'other' }

// Runs in the sandbox: lstat every path git lists (tracked plus untracked, minus .gitignore'd),
// never following symlinks, and prints [path, size, kind] tuples as JSON.
const INVENTORY_JS =
  'const fs=require("fs");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=[];' +
  'for(const p of d.split("\\0")){if(!p)continue;let s;try{s=fs.lstatSync(p)}catch{continue}' +
  'o.push([p,s.size,s.isSymbolicLink()?"l":s.isFile()?"f":"o"])}process.stdout.write(JSON.stringify(o))})'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function remoteInventory(config: string, root: string): Promise<RemoteEntry[]> {
  const out = await sshRun(
    config,
    `cd ${shellQuote(root)} && git ls-files -co --exclude-standard -z | node -e ${shellQuote(INVENTORY_JS)}`,
    64 * 1024 * 1024
  )
  const parsed: unknown = JSON.parse(out)
  if (!Array.isArray(parsed)) {
    throw new Error('The sandbox returned an unreadable file list.')
  }
  return parsed.flatMap((row: unknown) => {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'number') {
      return []
    }
    const kind = row[2] === 'f' ? 'file' : row[2] === 'l' ? 'link' : 'other'
    return [{ path: row[0], size: row[1], kind }]
  })
}

/** The sandbox's recent commits, newest first, to find one this Mac already has. */
export async function remoteHistory(config: string, root: string): Promise<string[]> {
  const out = await sshRun(config, `git -C ${shellQuote(root)} rev-list --max-count=500 HEAD`)
  return out.split('\n').filter((line) => /^[0-9a-f]{40}$/.test(line))
}
