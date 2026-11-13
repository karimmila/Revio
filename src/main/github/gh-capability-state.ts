// Require gh >=2.40 multi-account support per execution runtime before offering bindings.
import { parseWslUncPath } from '../../shared/wsl-paths'
import type { GhMultiAccountCapability } from '../../shared/github/auth-types'
import {
  createGhLogicalLifetime,
  type GhCaptureLifetimeHooks
} from '../git/command-runner/gh-capture-lifetime'

export type GhCapabilityTarget = {
  cwd?: string
  wslDistro?: string
}

const CAPABILITY_UNSUPPORTED_RETRY_MS = 30 * 60_000
const CAPABILITY_UNKNOWN_RETRY_MS = 60_000

type CachedCapability = {
  value: GhMultiAccountCapability
  retryAfterMs: number
}

const capabilityByExecutionHost = new Map<string, CachedCapability>()
type CapabilityProbe = {
  result: Promise<GhMultiAccountCapability>
  lifetime: ReturnType<typeof createGhLogicalLifetime>
}
const probesByExecutionHost = new Map<string, CapabilityProbe>()
/** Bumped on invalidate so in-flight probes cannot commit stale results. */
const generationByExecutionHost = new Map<string, number>()

/** Infer UNC distros so probe execution matches cache ownership. */
export function normalizeGhCapabilityTarget(target: GhCapabilityTarget = {}): GhCapabilityTarget {
  const wslDistro =
    target.wslDistro ?? (target.cwd ? parseWslUncPath(target.cwd)?.distro : undefined)
  return {
    ...(target.cwd ? { cwd: target.cwd } : {}),
    ...(wslDistro ? { wslDistro } : {})
  }
}

/** Cache key isolating native, per-distro WSL, and SSH capability state from each other. */
export function getGhExecutionHostKey(target: GhCapabilityTarget = {}): string {
  const normalized = normalizeGhCapabilityTarget(target)
  return normalized.wslDistro ? `wsl:${normalized.wslDistro}` : 'local'
}

// Per-project gh account binding is retired: every call uses the GitHub App token, and resolving
// a bound account meant `gh auth token --user`, a keychain read. No probe runs.
async function probeMultiAccountCapability(
  _target: GhCapabilityTarget,
  _hooks?: GhCaptureLifetimeHooks
): Promise<GhMultiAccountCapability> {
  return 'unsupported'
}

/** Probes `gh auth token --user` support; 'unknown' means the probe itself failed and must not be cached as unsupported. */
export async function getGhMultiAccountCapability(
  target: GhCapabilityTarget = {},
  nowMs = Date.now(),
  hooks?: GhCaptureLifetimeHooks
): Promise<GhMultiAccountCapability> {
  const normalized = normalizeGhCapabilityTarget(target)
  const key = getGhExecutionHostKey(normalized)
  const cached = capabilityByExecutionHost.get(key)
  if (cached && nowMs < cached.retryAfterMs) {
    return cached.value
  }
  if (cached && nowMs >= cached.retryAfterMs) {
    capabilityByExecutionHost.delete(key)
  }

  const inFlight = probesByExecutionHost.get(key)
  if (inFlight) {
    hooks?.onTerminationPending(inFlight.lifetime.terminated)
    const result = await inFlight.result
    if (hooks) {
      await inFlight.lifetime.waitPending()
    }
    return result
  }

  const generation = generationByExecutionHost.get(key) ?? 0
  const lifetime = createGhLogicalLifetime()
  hooks?.onTerminationPending(lifetime.terminated)
  const probe = probeMultiAccountCapability(normalized, lifetime.hooks).then((value) => {
    lifetime.seal()
    if ((generationByExecutionHost.get(key) ?? 0) !== generation) {
      return value
    }
    const retryAfterMs =
      nowMs +
      (value === 'supported'
        ? Number.POSITIVE_INFINITY
        : value === 'unsupported'
          ? CAPABILITY_UNSUPPORTED_RETRY_MS
          : CAPABILITY_UNKNOWN_RETRY_MS)
    capabilityByExecutionHost.set(key, {
      value,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : Number.MAX_SAFE_INTEGER
    })
    return value
  })
  const holder = { result: probe, lifetime }
  probesByExecutionHost.set(key, holder)
  try {
    const result = await probe
    if (hooks) {
      await lifetime.waitPending()
    }
    return result
  } finally {
    lifetime.seal()
    if (probesByExecutionHost.get(key) === holder) {
      probesByExecutionHost.delete(key)
    }
  }
}

/** Bumps the generation so a probe already in flight cannot commit its now-stale result. */
export function invalidateGhMultiAccountCapability(target?: GhCapabilityTarget): void {
  if (!target) {
    capabilityByExecutionHost.clear()
    probesByExecutionHost.clear()
    for (const key of generationByExecutionHost.keys()) {
      generationByExecutionHost.set(key, (generationByExecutionHost.get(key) ?? 0) + 1)
    }
    return
  }
  const key = getGhExecutionHostKey(target)
  capabilityByExecutionHost.delete(key)
  probesByExecutionHost.delete(key)
  generationByExecutionHost.set(key, (generationByExecutionHost.get(key) ?? 0) + 1)
}

export function createGhMultiAccountUnsupportedError(): Error & {
  code: 'gh_multi_account_unsupported'
  stderr: string
} {
  const message =
    'This GitHub CLI is too old for per-project account binding (needs gh ≥ 2.40 with `gh auth token --user`).'
  return Object.assign(new Error(message), {
    code: 'gh_multi_account_unsupported' as const,
    stderr: message
  })
}

/** @internal — test-only */
export function clearGhCapabilityStateForTests(): void {
  capabilityByExecutionHost.clear()
  probesByExecutionHost.clear()
  generationByExecutionHost.clear()
}
