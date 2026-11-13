import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { cloudDataRoot } from './cloud-repo-store'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/** The port websockify listens on inside the sandbox; Vercel exposes it as wss://<domain>. */
export const SANDBOX_SSH_BRIDGE_PORT = 8022

/**
 * Bridges ssh's stdin/stdout to the sandbox's WebSocket. Written next to Orca's cloud data at
 * first use and run with Orca's own Node (ELECTRON_RUN_AS_NODE), so nothing extra is installed.
 */
const WS_PROXY_SOURCE = `const ws = new WebSocket(process.argv[2])
ws.binaryType = 'arraybuffer'
ws.onopen = () => {
  process.stdin.on('data', (chunk) => ws.send(chunk))
  process.stdin.on('end', () => ws.close())
}
ws.onmessage = (event) => process.stdout.write(Buffer.from(event.data))
ws.onclose = () => process.exit(0)
ws.onerror = () => { process.stderr.write('${FORK_PRODUCT_NAME} cloud: the sandbox did not answer\\n'); process.exit(1) }
`

function keysDir(): string {
  const dir = join(cloudDataRoot(), 'keys')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

export function workspaceKeyPath(instanceId: string): string {
  if (!/^[\w-]+$/.test(instanceId)) {
    throw new Error('Unknown cloud workspace')
  }
  return join(keysDir(), instanceId)
}

/** Where a workspace made with the person's own key records that key's path. */
function customKeyMarker(instanceId: string): string {
  return `${workspaceKeyPath(instanceId)}.custom-key`
}

/**
 * The private key ssh uses for a cloud workspace: the person's own key when the workspace was
 * made with one ("SSH private key path"), else the key Orca generated for it.
 */
export function workspaceIdentityFile(instanceId: string): string {
  const marker = customKeyMarker(instanceId)
  return existsSync(marker) ? readFileSync(marker, 'utf8').trim() : workspaceKeyPath(instanceId)
}

/** The public half of the person's own key, read from `<path>.pub`; the private key never moves. */
export function adoptOwnWorkspaceKey(instanceId: string, privateKeyPath: string): string {
  const path = privateKeyPath.trim().replace(/^~(?=\/)/, homedir())
  if (!isAbsolute(path) || !existsSync(path)) {
    throw new Error(`The SSH private key ${path} was not found.`)
  }
  const publicKey = existsSync(`${path}.pub`) ? readFileSync(`${path}.pub`, 'utf8').trim() : ''
  if (!/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp\d+) [A-Za-z0-9+/=]+( .*)?$/.test(publicKey)) {
    throw new Error(`${FORK_PRODUCT_NAME} needs the public key next to it, at ${path}.pub.`)
  }
  writeFileSync(customKeyMarker(instanceId), path, { mode: 0o600 })
  return publicKey
}

/** One key per cloud workspace, made by the Mac's ssh-keygen and never copied anywhere else. */
export async function createWorkspaceKey(instanceId: string): Promise<string> {
  const path = workspaceKeyPath(instanceId)
  rmSync(path, { force: true })
  rmSync(`${path}.pub`, { force: true })
  rmSync(customKeyMarker(instanceId), { force: true })
  const result = await runProcess({
    program: resolveSelectedLocalCommand('ssh-keygen', { env: process.env }),
    args: ['-q', '-t', 'ed25519', '-N', '', '-C', `orca-cloud-${instanceId}`, '-f', path],
    env: process.env,
    timeoutMs: 15_000
  })
  if (result.code !== 0) {
    throw new Error(`ssh-keygen failed: ${result.stderr.trim()}`)
  }
  return readFileSync(`${path}.pub`, 'utf8').trim()
}

let ownSshKeyPath: () => string = () => ''

/** "SSH private key path": empty makes a key per workspace. */
export function setCloudSshKeyPathReader(next: () => string): void {
  ownSshKeyPath = next
}

/** The public key a new cloud workspace authorizes: the person's own, else a fresh one. */
export async function prepareWorkspaceKey(instanceId: string): Promise<string> {
  const own = ownSshKeyPath().trim()
  return own ? adoptOwnWorkspaceKey(instanceId, own) : createWorkspaceKey(instanceId)
}

export function removeWorkspaceKey(instanceId: string): void {
  const path = workspaceKeyPath(instanceId)
  rmSync(path, { force: true })
  rmSync(`${path}.pub`, { force: true })
  rmSync(customKeyMarker(instanceId), { force: true })
}

export function proxyCommandFor(domainUrl: string): string {
  const script = join(cloudDataRoot(), 'wsproxy.mjs')
  if (!existsSync(script) || readFileSync(script, 'utf8') !== WS_PROXY_SOURCE) {
    writeFileSync(script, WS_PROXY_SOURCE, { mode: 0o600 })
  }
  const url = domainUrl.replace(/^https:/, 'wss:')
  return `/usr/bin/env ELECTRON_RUN_AS_NODE=1 ${quotePosixShell(process.execPath)} ${quotePosixShell(script)} ${quotePosixShell(url)}`
}

/**
 * Starts SSH inside the sandbox (as root) and prints its host key. Host keys are made on the
 * first start, so every workspace has its own; later starts (after a resume) reuse them.
 */
export function sshStartScript(authorizedKey: string | null): string {
  const authorize = authorizedKey
    ? `install -d -m 700 -o ubuntu -g ubuntu /vercel/.ssh
printf '%s\\n' ${quotePosixShell(authorizedKey)} > /vercel/.ssh/authorized_keys
chown ubuntu:ubuntu /vercel/.ssh/authorized_keys && chmod 600 /vercel/.ssh/authorized_keys
`
    : ''
  return `set -e
${authorize}[ -f /etc/ssh/ssh_host_ed25519_key ] || ssh-keygen -A >/dev/null
mkdir -p /run/sshd
pgrep -x sshd >/dev/null || /usr/sbin/sshd
# Checks the port, not pgrep -f: this script's own command line contains the websockify arguments.
if ! ss -ltn | grep -q ':${SANDBOX_SSH_BRIDGE_PORT} '; then
  (setsid nohup websockify 0.0.0.0:${SANDBOX_SSH_BRIDGE_PORT} 127.0.0.1:22 >/tmp/websockify.log 2>&1 < /dev/null &)
fi
for _ in $(seq 1 20); do ss -ltn | grep -q ':${SANDBOX_SSH_BRIDGE_PORT} ' && break; sleep 0.25; done
cat /etc/ssh/ssh_host_ed25519_key.pub
`
}

/**
 * Values every SSH session in the sandbox sees (pam_env reads /etc/environment for each login),
 * so terminals and agents Orca starts there get them. Values with quotes or newlines are skipped:
 * /etc/environment has no escaping.
 */
export function sandboxEnvironmentScript(values: Record<string, string>): {
  script: string
  skipped: string[]
} {
  const skipped: string[] = []
  const lines: string[] = []
  for (const [key, value] of Object.entries(values)) {
    if (/["\n\r\\]/.test(value)) {
      skipped.push(key)
    } else {
      lines.push(`${key}="${value}"`)
    }
  }
  const body = lines.join('\n')
  return {
    script: `sed -i '/# orca-cloud-begin/,/# orca-cloud-end/d' /etc/environment
printf '%s\\n' '# orca-cloud-begin' ${body ? `${quotePosixShell(body)} ` : ''}'# orca-cloud-end' >> /etc/environment
`,
    skipped
  }
}
