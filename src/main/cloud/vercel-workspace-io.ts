import { runProcess } from '@orca/process-host'
import type { ProcessRunResult } from '../../shared/ephemeral-vm-recipe-process'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import { humanCloudError } from './cloud-errors'
import { DEFAULT_SANDBOX_NETWORK, type SandboxNetwork } from './cloud-network-policy'

export function networkOf(config: {
  network?: 'open' | 'allowlist'
  extraDomains?: string[]
}): SandboxNetwork {
  return {
    mode: config.network ?? DEFAULT_SANDBOX_NETWORK.mode,
    extraDomains: config.extraDomains ?? []
  }
}

export { isSandboxGone } from './cloud-errors'

export type Io = {
  signal?: AbortSignal
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

export function done(stdout: string): ProcessRunResult {
  return { stdout, stderr: '', exitCode: 0, signal: null }
}

export function failed(error: unknown, io: Io): ProcessRunResult {
  const message = humanCloudError(error)
  io.onStderr?.(`${message}\n`)
  return {
    stdout: '',
    stderr: message,
    exitCode: 1,
    signal: null,
    ...(io.signal?.aborted ? { aborted: true as const } : {})
  }
}

type GitIdentity = { name: string; email: string }

let identityOverride: () => Partial<GitIdentity> | undefined = () => undefined

/** Settings, Git, "Git identity": the name and email cloud workspaces commit with. */
export function setCloudGitIdentityOverride(read: () => Partial<GitIdentity> | undefined): void {
  identityOverride = read
}

/** The identity a cloud workspace commits with: Settings' Git identity, field by field over the Mac's git config. */
export async function cloudGitIdentity(repoPath: string): Promise<GitIdentity> {
  const override = identityOverride()
  const name = override?.name?.trim()
  const email = override?.email?.trim()
  if (name && email) {
    return { name, email }
  }
  const local = await localGitIdentity(repoPath)
  return { name: name || local.name, email: email || local.email }
}

export async function localGitIdentity(repoPath: string): Promise<{ name: string; email: string }> {
  const read = async (key: string): Promise<string> => {
    const result = await runProcess({
      program: resolveSelectedLocalCommand('git', { env: process.env }),
      args: ['-C', repoPath, 'config', '--get', key],
      env: process.env,
      timeoutMs: 5000
    })
    return result.code === 0 ? result.stdout.trim() : ''
  }
  return { name: await read('user.name'), email: await read('user.email') }
}
