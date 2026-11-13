import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SshTarget } from '../../shared/ssh-types'
import { getAppEnvironment } from '../../shared/app-environment'

/**
 * Cloud sandboxes (on-demand runtimes) get one trusted host key, read through the provider's
 * authenticated API when the sandbox starts. It lives in Orca's data folder, keyed by runtime id,
 * so no stored setting can point ssh at another file, and ~/.ssh/known_hosts is never touched.
 */
let root = (): string => join(getAppEnvironment().getPath('userData'), 'cloud-host-keys')

function fileFor(runtimeId: string): string {
  return join(root(), `${runtimeId.replace(/[^A-Za-z0-9_-]/g, '_')}.known_hosts`)
}

export function pinnedKnownHostsFile(target: Pick<SshTarget, 'owner'>): string | null {
  if (target.owner?.type !== 'on-demand-runtime') {
    return null
  }
  const file = fileFor(target.owner.runtimeId)
  return existsSync(file) ? file : null
}

/** Records the sandbox's key under the ssh host name the target connects to. */
export function pinHostKey(runtimeId: string, host: string, publicKey: string): string {
  const [type, key] = publicKey.trim().split(/\s+/)
  if (!type || !key || !/^[A-Za-z0-9+/=]+$/.test(key) || !/^[\w.@-]+$/.test(host)) {
    throw new Error('Refusing to pin a malformed host key')
  }
  mkdirSync(root(), { recursive: true, mode: 0o700 })
  const file = fileFor(runtimeId)
  writeFileSync(file, `${host} ${type} ${key}\n`, { mode: 0o600 })
  return file
}

/** Drops a destroyed sandbox's pin, so a later runtime can never inherit it. */
export function forgetPinnedHostKey(runtimeId: string): void {
  rmSync(fileFor(runtimeId), { force: true })
}

export function setPinnedHostKeyRootForTest(next: () => string): void {
  root = next
}
