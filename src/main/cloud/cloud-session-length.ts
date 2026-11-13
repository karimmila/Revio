import type { Sandbox } from '@vercel/sandbox'
import type { VercelCloudLimits } from '../../shared/vercel-cloud/vercel-cloud-types'
import { readVercelStatus } from '../vercel-cloud/vercel-cloud-auth'

/**
 * Vercel takes at most 45 minutes as a sandbox's timeout when it is created, on every plan (a Pro
 * team's create with a day was refused: "`timeout` should be <= 45m", 2026-11-09). A longer plan
 * limit is reached by extending the running session once.
 */
export const CREATE_TIMEOUT_MS = 45 * 60 * 1000

// Vercel's documented Pro ceiling, tried when the plan's own figure is refused.
const FALLBACK_TOTAL_MS = 5 * 60 * 60 * 1000

/** Extends a running session to the plan's limit; best effort, never fails the caller. */
export async function extendToPlanLimit(
  sandbox: Pick<Sandbox, 'extendTimeout'>,
  limits: Pick<VercelCloudLimits, 'maxSessionMinutes'> | null
): Promise<number> {
  const target = (limits?.maxSessionMinutes ?? 45) * 60 * 1000
  for (const total of [target, Math.min(target, FALLBACK_TOTAL_MS)]) {
    if (total <= CREATE_TIMEOUT_MS) {
      return CREATE_TIMEOUT_MS
    }
    try {
      await sandbox.extendTimeout(total - CREATE_TIMEOUT_MS)
      return total
    } catch {
      // Over this plan's ceiling: try the smaller one, or keep the 45 minutes.
    }
  }
  return CREATE_TIMEOUT_MS
}

/** The connected team's limits, or null when Vercel cannot be read. */
export async function readVercelLimits(): Promise<VercelCloudLimits | null> {
  const status = await readVercelStatus()
  return status.state === 'connected' ? status.limits : null
}
