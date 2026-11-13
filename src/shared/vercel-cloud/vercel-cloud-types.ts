export type VercelTeamSummary = {
  id: string
  slug: string
  name: string
  plan: string
}

/**
 * What one sandbox may use on the connected team's plan. Vercel enforces these server side (it
 * answers 400 above them); Orca reads them so it never asks for more.
 */
export type VercelCloudLimits = {
  plan: string
  maxVcpus: number
  defaultVcpus: number
  /** The longest one sandbox session may run before it must be stopped and resumed. */
  maxSessionMinutes: number
  /** The plan's free monthly allowance, when it has one worth showing. */
}

/** How Orca reaches Vercel: the browser sign-in, or an access token scoped to one team. */
export type VercelConnectionKind = 'oauth' | 'token'

export type VercelCloudStatus =
  | { state: 'disconnected' }
  | {
      /** Signed in, but no team picked yet: nothing has been created on Vercel. */
      state: 'choose-team'
      via: VercelConnectionKind
      username: string
      teams: VercelTeamSummary[]
    }
  | {
      state: 'connected'
      via: VercelConnectionKind
      username: string
      team: VercelTeamSummary
      teams: VercelTeamSummary[]
      projectId: string
      limits: VercelCloudLimits
      /** A team token's expiry (epoch ms), when Vercel states one. */
      tokenExpiresAt?: number | null
    }
  | { state: 'error'; message: string }

export type VercelSignInStart = {
  userCode: string
  verificationUri: string
}

/**
 * Hobby caps from Vercel's 400 answers on 2026-11-07 ("resources.vcpus should be <= 4", "timeout
 * restricted to <= 45m on Hobby plans"); Pro and Enterprise allow 8 vCPUs and one day.
 */
export function limitsForPlan(plan: string): VercelCloudLimits {
  if (plan === 'hobby') {
    return { plan, maxVcpus: 4, defaultVcpus: 2, maxSessionMinutes: 45 }
  }
  return { plan, maxVcpus: 8, defaultVcpus: 4, maxSessionMinutes: 24 * 60 }
}
