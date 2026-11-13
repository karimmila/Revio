import { chmodSync, existsSync, lstatSync, mkdirSync, rmSync, unlinkSync } from 'node:fs'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { runProcess } from '@orca/process-host'
import type { CloudMirrorStatus } from '../../shared/cloud/cloud-types'
import { writeSecureFile } from '../../shared/secure-file'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import {
  cloudMirrorsRoot,
  remoteHistory,
  remoteInventory,
  sshRun,
  writeMirrorSshConfig,
  MIRROR_SSH_HOST,
  type SandboxTarget
} from './cloud-mirror-remote'
import { readMirrorState, writeMirrorState, type MirrorRecord } from './cloud-mirror-state'
import { humanCloudError } from './cloud-errors'
import { isSafeMirrorPath } from './cloud-mirror-paths'
import { bestEffort } from './cloud-log'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_BYTES = 500 * 1024 * 1024

async function run(program: string, args: string[], input?: string): Promise<string> {
  const result = await runProcess({
    program: resolveSelectedLocalCommand(program, { env: process.env }),
    args,
    env: process.env,
    timeoutMs: 180_000,
    maxOutputBytes: 64 * 1024 * 1024,
    ...(input === undefined ? {} : { input })
  })
  if (result.code !== 0) {
    throw new Error(`${program} failed: ${result.stderr.trim().split('\n').slice(-3).join(' ')}`)
  }
  return result.stdout
}

export { isSafeMirrorPath }

/** The repository's core.hooksPath when it points inside the checkout, for isSafeMirrorPath. */
export async function relativeHooksPath(repoPath: string): Promise<string[]> {
  const configured = (
    await run('git', ['-C', repoPath, 'config', '--get', 'core.hooksPath']).catch(() => '')
  ).trim()
  if (!configured || isAbsolute(configured) || configured.startsWith('~')) {
    return []
  }
  return [configured]
}

/** No folder on the way to the file may be a symlink, or a write could land outside the mirror. */
function hasSymlinkedParent(mirror: string, path: string, checked: Map<string, boolean>): boolean {
  const parts = path.split('/').slice(0, -1)
  let current = mirror
  for (const part of parts) {
    current = join(current, part)
    let linked = checked.get(current)
    if (linked === undefined) {
      try {
        linked = lstatSync(current).isSymbolicLink()
      } catch {
        linked = false
      }
      checked.set(current, linked)
    }
    if (linked) {
      return true
    }
  }
  return false
}

function insideMirrorsRoot(path: string): boolean {
  const rel = relative(cloudMirrorsRoot(), path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

async function createMirror(
  record: Omit<MirrorRecord, 'mirrorPath' | 'createdBranch' | 'branch'>,
  config: string,
  target: SandboxTarget,
  workspaceName: string
): Promise<Pick<MirrorRecord, 'mirrorPath' | 'branch' | 'createdBranch'>> {
  const history = await remoteHistory(config, target.projectRoot)
  const known = await run(
    'git',
    ['-C', record.repoPath, 'cat-file', '--batch-check'],
    history.map((sha) => `${sha}^{commit}`).join('\n')
  )
  const base = history.find((_sha, index) => !known.split('\n')[index]?.endsWith('missing'))
  if (!base) {
    throw new Error('None of the sandbox commits are on this Mac yet; fetch the repository first.')
  }
  const branch = (
    await sshRun(config, `git -C '${target.projectRoot}' branch --show-current`)
  ).trim()
  const parent = join(cloudMirrorsRoot(), basename(record.repoPath))
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  let mirrorPath = join(parent, workspaceName.replace(/[^\w.-]/g, '-') || 'workspace')
  for (let suffix = 2; existsSync(mirrorPath); suffix += 1) {
    mirrorPath = join(parent, `${basename(mirrorPath).replace(/-\d+$/, '')}-${suffix}`)
  }
  await run('git', ['-C', record.repoPath, 'worktree', 'add', '--detach', mirrorPath, base])
  chmodSync(mirrorPath, 0o700)
  let createdBranch = false
  if (/^[\w./-]+$/.test(branch)) {
    // The mirror is on the cloud branch's name, so Orca shows it as that workspace's copy; an
    // existing local branch of that name is left alone and the mirror stays detached.
    createdBranch = await run('git', ['-C', mirrorPath, 'switch', '-q', '-c', branch])
      .then(() => true)
      .catch(() => false)
  }
  return { mirrorPath, branch, createdBranch }
}

let forgetImportedMirror: (repoId: string, mirrorPath: string) => void = () => undefined

/** Main's hook to drop an archived mirror from the repository's shown worktrees. */
export function setForgetImportedMirror(next: (repoId: string, mirrorPath: string) => void): void {
  forgetImportedMirror = next
}

const inFlight = new Map<string, Promise<CloudMirrorStatus>>()
// Archived runtimes never sync again: a sync that outlived the archive used to write its record back.
const archived = new Set<string>()

/**
 * One-way sync, sandbox to Mac: the files git lists in the sandbox (tracked plus untracked, minus
 * ignored) are copied into the mirror over the workspace's own SSH; files gone from the sandbox
 * are removed from the mirror. Symlinks are never copied or followed, nothing is written outside
 * the mirror, and nothing is ever written to the sandbox.
 */
export function syncCloudMirror(args: {
  repoId: string
  repoPath: string
  workspaceName: string
  target: SandboxTarget
}): Promise<CloudMirrorStatus> {
  if (archived.has(args.target.runtimeId)) {
    return Promise.resolve({
      state: 'never',
      mirrorPath: null,
      lastSyncedAt: null,
      error: null,
      files: 0,
      deleted: 0,
      skippedLinks: 0,
      skippedLarge: 0
    })
  }
  const running = inFlight.get(args.target.runtimeId)
  if (running) {
    return running
  }
  const work = doSync(args).finally(() => inFlight.delete(args.target.runtimeId))
  inFlight.set(args.target.runtimeId, work)
  return work
}

async function doSync(args: {
  repoId: string
  repoPath: string
  workspaceName: string
  target: SandboxTarget
}): Promise<CloudMirrorStatus> {
  const { target } = args
  const previous = readMirrorState()[target.runtimeId]
  // Off until the person turns it on: every sync writes sandbox-chosen files onto this Mac.
  const base = { repoId: args.repoId, repoPath: args.repoPath, enabled: previous?.enabled ?? false }
  try {
    const config = writeMirrorSshConfig(target)
    const location =
      previous?.mirrorPath && existsSync(previous.mirrorPath)
        ? previous
        : await createMirror(
            { ...base, lastSyncedAt: null, lastError: null },
            config,
            target,
            args.workspaceName
          )
    const mirror = location.mirrorPath
    const entries = await remoteInventory(config, target.projectRoot)
    const blocked = await relativeHooksPath(args.repoPath)
    const checked = new Map<string, boolean>()
    let total = 0
    let skippedLinks = 0
    let skippedLarge = 0
    const files: string[] = []
    for (const entry of entries) {
      if (entry.kind === 'link') {
        skippedLinks += 1
        continue
      }
      if (entry.kind !== 'file' || !isSafeMirrorPath(entry.path, blocked)) {
        continue
      }
      if (entry.size > MAX_FILE_BYTES) {
        skippedLarge += 1
        continue
      }
      if (hasSymlinkedParent(mirror, entry.path, checked)) {
        continue
      }
      total += entry.size
      files.push(entry.path)
    }
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(
        `The sandbox has ${Math.round(total / 1048576)} MB to sync; the limit is 500 MB.`
      )
    }
    const listFile = join(cloudMirrorsRoot(), '.config', `${target.runtimeId}.files`)
    writeSecureFile(listFile, `${files.join('\n')}\n`)
    // -rt without -l: symlinks are skipped, never recreated; --safe-links guards the rest.
    await run('rsync', [
      '-rt',
      '--safe-links',
      `--max-size=${MAX_FILE_BYTES}`,
      `--files-from=${listFile}`,
      '-e',
      `ssh -F "${join(cloudMirrorsRoot(), '.config', `${target.runtimeId}.ssh_config`)}"`,
      `${MIRROR_SSH_HOST}:${target.projectRoot}/`,
      `${mirror}/`
    ])
    rmSync(listFile, { force: true })
    const remote = new Set(entries.map((entry) => entry.path))
    const local = (
      await run('git', ['-C', mirror, 'ls-files', '-co', '--exclude-standard', '-z'])
    ).split('\0')
    let deleted = 0
    for (const path of local) {
      if (!path || remote.has(path) || !isSafeMirrorPath(path, blocked)) {
        continue
      }
      const full = join(mirror, path)
      if (!full.startsWith(`${mirror}${sep}`) || hasSymlinkedParent(mirror, path, checked)) {
        continue
      }
      try {
        if (lstatSync(full).isFile()) {
          unlinkSync(full)
          deleted += 1
        }
      } catch {
        // Already gone.
      }
    }
    const record: MirrorRecord = {
      ...base,
      mirrorPath: mirror,
      branch: location.branch,
      createdBranch: location.createdBranch,
      lastSyncedAt: Date.now(),
      lastError: null
    }
    writeMirrorState(target.runtimeId, record)
    return {
      state: 'synced',
      mirrorPath: mirror,
      lastSyncedAt: record.lastSyncedAt,
      error: null,
      files: files.length,
      deleted,
      skippedLinks,
      skippedLarge
    }
  } catch (error) {
    const message = humanCloudError(error)
    if (previous) {
      writeMirrorState(target.runtimeId, { ...previous, lastError: message })
    }
    return {
      state: 'failed',
      mirrorPath: previous?.mirrorPath ?? null,
      lastSyncedAt: previous?.lastSyncedAt ?? null,
      error: message,
      files: 0,
      deleted: 0,
      skippedLinks: 0,
      skippedLarge: 0
    }
  }
}

/** Archive: the mirror's worktree, the branch Orca made for it, its folder and its config. */
export async function removeCloudMirror(runtimeId: string): Promise<void> {
  archived.add(runtimeId)
  // doSync turns every failure into a status, so this only waits for it to settle.
  await inFlight.get(runtimeId)
  const record = readMirrorState()[runtimeId]
  rmSync(join(cloudMirrorsRoot(), '.config', `${runtimeId}.ssh_config`), { force: true })
  rmSync(join(cloudMirrorsRoot(), '.config', `${runtimeId}.files`), { force: true })
  if (!record) {
    return
  }
  if (record.mirrorPath && insideMirrorsRoot(record.mirrorPath)) {
    await run('git', [
      '-C',
      record.repoPath,
      'worktree',
      'remove',
      '--force',
      record.mirrorPath
    ]).catch(bestEffort('Removing the mirror worktree'))
    rmSync(record.mirrorPath, { recursive: true, force: true })
    await run('git', ['-C', record.repoPath, 'worktree', 'prune']).catch(
      bestEffort('Pruning worktrees')
    )
    forgetImportedMirror(record.repoId, record.mirrorPath)
  }
  if (record.createdBranch && record.branch) {
    await run('git', ['-C', record.repoPath, 'branch', '-D', record.branch]).catch(
      bestEffort('Deleting the mirror branch')
    )
  }
  writeMirrorState(runtimeId, null)
}
