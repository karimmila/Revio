import { createHash } from 'node:crypto'
import { readdirSync, rmSync } from 'node:fs'
import { join, posix } from 'node:path'
import type { RuntimeTransportMetadata } from '../../../../shared/runtime-bootstrap'
import { unixSocketPathFits } from '../../../../shared/unix-socket-path-limit'
import { ensureOwnedPrivateDir } from '../../../daemon/endpoint/publication/daemon-socket-endpoint-path'

// Keep the fallback independent of how long the user's home or profile path is.
const SHORT_RUNTIME_SOCKET_DIR_PREFIX = '/tmp/.orca-runtime-'

/**
 * Where an overlong runtime socket goes instead: a per-user private folder in /tmp, one per
 * profile. A deep userData (a long home name, or a test profile) put `o-<pid>-<id>.sock` past
 * macOS's 104-byte sun_path limit and startup failed with "listen EINVAL" (2026-11-10).
 */
export function shortRuntimeSocketDir(userDataPath: string, uid: number): string {
  const profileHash = createHash('sha256').update(userDataPath).digest('hex').slice(0, 12)
  return `${SHORT_RUNTIME_SOCKET_DIR_PREFIX}${uid}/${profileHash}`
}

/** Creates (or checks) the private fallback folders before binding; refuses foreign ones. */
export function ensureRuntimeSocketDir(endpoint: string, uid: number | undefined): void {
  if (uid === undefined || !endpoint.startsWith(`${SHORT_RUNTIME_SOCKET_DIR_PREFIX}${uid}/`)) {
    return
  }
  const dir = posix.dirname(endpoint)
  ensureOwnedPrivateDir(posix.dirname(dir), uid)
  ensureOwnedPrivateDir(dir, uid)
}

// MUST match createRuntimeTransportMetadata's o-${pid}-${suffix}.sock naming; unit tests enforce parity.
export const RUNTIME_SOCKET_NAME_REGEX = /^o-(\d+)-[A-Za-z0-9_-]+\.sock$/

export function sweepOrphanedRuntimeSockets(userDataPath: string, ownPid: number): void {
  let entries: string[]
  try {
    entries = readdirSync(userDataPath)
  } catch {
    // First launch may have no userData to sweep.
    return
  }
  for (const entry of entries) {
    const match = RUNTIME_SOCKET_NAME_REGEX.exec(entry)
    if (!match) {
      continue
    }
    const pid = Number(match[1])
    if (!Number.isFinite(pid)) {
      continue
    }
    // Never sweep our own socket before binding it.
    if (pid === ownPid) {
      continue
    }
    try {
      // Signal zero only probes liveness: ESRCH is dead; EPERM is a foreign owner and must remain.
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        try {
          rmSync(join(userDataPath, entry), { force: true })
        } catch {
          // Sweep best-effort; later startup or reboot handles unlink failures.
        }
      }
    }
  }
}

export function createRuntimeTransportMetadata(
  userDataPath: string,
  pid: number,
  platform: NodeJS.Platform,
  runtimeId = 'runtime',
  uid: number | undefined = process.getuid?.()
): RuntimeTransportMetadata {
  const endpointSuffix = runtimeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 4) || 'rt'
  if (platform === 'win32') {
    return {
      kind: 'named-pipe',
      // Named pipes lack Unix chmod; use per-runtime suffixes to avoid stable, guessable endpoints.
      endpoint: `\\\\.\\pipe\\orca-${pid}-${endpointSuffix}`
    }
  }
  const name = `o-${pid}-${endpointSuffix}.sock`
  const preferred = join(userDataPath, name)
  if (
    uid === undefined ||
    unixSocketPathFits(preferred, platform === 'darwin' ? 'darwin' : 'linux')
  ) {
    return { kind: 'unix', endpoint: preferred }
  }
  return { kind: 'unix', endpoint: posix.join(shortRuntimeSocketDir(userDataPath, uid), name) }
}
