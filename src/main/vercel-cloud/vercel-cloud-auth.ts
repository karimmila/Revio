import { shell } from 'electron'
import { OAuth, isOAuthError } from '@vercel/sandbox/dist/auth/index.js'
import {
  limitsForPlan,
  type VercelCloudStatus,
  type VercelSignInStart
} from '../../shared/vercel-cloud/vercel-cloud-types'
import {
  ensureSandboxProject,
  fetchVercelTeams,
  fetchVercelTokenExpiry,
  fetchVercelUser
} from './vercel-cloud-api'
import {
  clearVercelCredentials,
  readVercelCredentials,
  writeVercelCredentials,
  type VercelCredentials
} from './vercel-cloud-credentials'
import { bestEffort } from '../cloud/cloud-log'

const REFRESH_MARGIN_MS = 2 * 60 * 1000

type PendingSignIn = { abort: AbortController; done: Promise<VercelCloudStatus> }
let pending: PendingSignIn | null = null

/**
 * After the browser sign-in Orca only stores the token and lists the account's teams. Nothing is
 * created on Vercel until the person picks the team in Settings > Cloud: an account can belong to
 * a company team that Orca must never touch, so no team is picked for them, even when there is one.
 */
async function connectWith(tokens: {
  access_token: string
  refresh_token?: string
  expires_in: number
}): Promise<VercelCloudStatus> {
  const [user, teams] = await Promise.all([
    fetchVercelUser(tokens.access_token),
    fetchVercelTeams(tokens.access_token)
  ])
  writeVercelCredentials({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    teamId: null,
    projectId: null,
    kind: 'oauth'
  })
  return { state: 'choose-team', via: 'oauth', username: user.username, teams }
}

/**
 * Vercel's device sign-in, with the client the Sandbox CLI uses. Polling is done here instead of
 * the SDK's pollForToken because that helper also overwrites the Vercel CLI's own login file.
 */
async function pollUntilSignedIn(
  request: { device_code: string; interval: number; expiresAt: number },
  signal: AbortSignal
): Promise<VercelCloudStatus> {
  const oauth = await OAuth()
  let intervalMs = request.interval * 1000
  while (Date.now() < request.expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    if (signal.aborted) {
      return { state: 'disconnected' }
    }
    const [requestError, response] = await oauth.deviceAccessTokenRequest(request.device_code)
    if (requestError) {
      intervalMs *= 2
      continue
    }
    const [tokenError, tokens] = await oauth.processTokenResponse(response)
    if (tokenError) {
      const code = isOAuthError(tokenError) ? tokenError.code : null
      if (code === 'authorization_pending') {
        continue
      }
      if (code === 'slow_down') {
        intervalMs += 5000
        continue
      }
      throw tokenError
    }
    return connectWith(tokens)
  }
  throw new Error('The Vercel sign-in timed out. Try again.')
}

export async function startVercelSignIn(): Promise<VercelSignInStart> {
  pending?.abort.abort()
  const oauth = await OAuth()
  const request = await oauth.deviceAuthorizationRequest()
  const abort = new AbortController()
  const done = pollUntilSignedIn(request, abort.signal)
  const current: PendingSignIn = { abort, done }
  pending = current
  // waitForVercelSignIn reports this failure to the person; here it only must not go unhandled.
  void done
    .catch(() => undefined)
    .finally(() => {
      if (pending === current) {
        pending = null
      }
    })
  await shell.openExternal(request.verification_uri_complete)
  return { userCode: request.user_code, verificationUri: request.verification_uri_complete }
}

export async function waitForVercelSignIn(): Promise<VercelCloudStatus> {
  if (!pending) {
    return readVercelStatus()
  }
  try {
    return await pending.done
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

export function cancelVercelSignIn(): void {
  pending?.abort.abort()
  pending = null
}

export async function freshCredentials(): Promise<VercelCredentials | null> {
  const stored = readVercelCredentials()
  if (stored?.kind === 'token') {
    if (stored.tokenExpiresAt && stored.tokenExpiresAt <= Date.now()) {
      throw new Error(
        'Your Vercel token expired. Create a new one and paste it in Settings > Cloud.'
      )
    }
    return stored
  }
  if (!stored || stored.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return stored
  }
  if (!stored.refreshToken) {
    throw new Error('Your Vercel sign-in expired. Connect again.')
  }
  // Single flight: Vercel rotates the refresh token, so a second concurrent refresh would spend
  // the same one twice and the loser's error would sign the person out.
  refreshing ??= refreshCredentials(stored, stored.refreshToken).finally(() => {
    refreshing = null
  })
  return refreshing
}

let refreshing: Promise<VercelCredentials> | null = null

async function refreshCredentials(
  stored: VercelCredentials,
  refreshToken: string
): Promise<VercelCredentials> {
  const tokens = await (await OAuth()).refreshToken(refreshToken)
  const next: VercelCredentials = {
    ...stored,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000
  }
  writeVercelCredentials(next)
  return next
}

/** What every sandbox call needs. Throws when Vercel is not connected. */
export async function vercelScope(): Promise<{
  token: string
  teamId: string
  projectId: string
}> {
  const credentials = await freshCredentials()
  if (!credentials?.teamId || !credentials.projectId) {
    throw new Error('Connect Vercel in Settings > Cloud first.')
  }
  return {
    token: credentials.accessToken,
    teamId: credentials.teamId,
    projectId: credentials.projectId
  }
}

/** Reads only; never creates anything on Vercel. */
export async function readVercelStatus(): Promise<VercelCloudStatus> {
  try {
    const credentials = await freshCredentials()
    if (!credentials) {
      return { state: 'disconnected' }
    }
    const via = credentials.kind ?? 'oauth'
    const [user, teams] = await Promise.all([
      fetchVercelUser(credentials.accessToken).catch(() => null),
      fetchVercelTeams(credentials.accessToken)
    ])
    const username = user?.username ?? teams[0]?.name ?? ''
    const team = teams.find((candidate) => candidate.id === credentials.teamId)
    if (!credentials.teamId || !credentials.projectId || !team) {
      return { state: 'choose-team', via, username, teams }
    }
    return {
      state: 'connected',
      via,
      username,
      team,
      teams,
      projectId: credentials.projectId,
      limits: limitsForPlan(team.plan),
      ...(via === 'token' ? { tokenExpiresAt: credentials.tokenExpiresAt ?? null } : {})
    }
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

/** The person's explicit pick: only now does Orca find or create its project in that team. */
export async function selectVercelTeam(teamId: string): Promise<VercelCloudStatus> {
  const credentials = await freshCredentials()
  if (!credentials) {
    return { state: 'disconnected' }
  }
  const teams = await fetchVercelTeams(credentials.accessToken)
  const team = teams.find((candidate) => candidate.id === teamId)
  if (!team) {
    throw new Error('That team is not on this Vercel connection.')
  }
  const projectId = await ensureSandboxProject(
    credentials.accessToken,
    team.id,
    credentials.teamId === team.id ? credentials.projectId : null
  )
  writeVercelCredentials({ ...credentials, teamId: team.id, projectId })
  return readVercelStatus()
}

/**
 * Connects with an access token the person created at vercel.com (Account Settings > Tokens)
 * with its scope set to one team. A token that reaches more than one team is refused, so Orca
 * can never land in another team, such as a company's. The token is sealed like the sign-in's.
 */
export async function connectVercelToken(token: string): Promise<VercelCloudStatus> {
  const trimmed = token.trim()
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(trimmed)) {
    throw new Error('That does not look like a Vercel access token.')
  }
  const teams = await fetchVercelTeams(trimmed)
  if (teams.length !== 1) {
    throw new Error(
      teams.length === 0
        ? 'This token reaches no team. Create a new token at vercel.com/account/tokens and set its Scope to your team.'
        : 'This token reaches more than one team. Create a new token at vercel.com/account/tokens and set its Scope to the one team to use.'
    )
  }
  const team = teams[0]!
  const tokenExpiresAt = await fetchVercelTokenExpiry(trimmed)
  const saved = readVercelCredentials()
  const projectId = await ensureSandboxProject(
    trimmed,
    team.id,
    saved?.teamId === team.id ? saved.projectId : null
  )
  cancelVercelSignIn()
  writeVercelCredentials({
    accessToken: trimmed,
    refreshToken: null,
    expiresAt: tokenExpiresAt ?? Number.MAX_SAFE_INTEGER,
    teamId: team.id,
    projectId,
    kind: 'token',
    tokenExpiresAt
  })
  return readVercelStatus()
}

/** Revokes the refresh token at Vercel (best effort), then forgets it on this Mac. */
export async function disconnectVercel(): Promise<void> {
  cancelVercelSignIn()
  const stored = readVercelCredentials()
  clearVercelCredentials()
  // A pasted token is the person's own; they revoke it at vercel.com if they want.
  if (stored?.kind !== 'token' && stored?.refreshToken) {
    await (
      await OAuth()
    )
      .revokeToken(stored.refreshToken)
      .catch(bestEffort('Revoking the Vercel refresh token'))
  }
}
