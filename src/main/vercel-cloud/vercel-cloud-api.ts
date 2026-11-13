import { z } from 'zod'
import type { VercelTeamSummary } from '../../shared/vercel-cloud/vercel-cloud-types'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'
import { unreachableServiceMessage } from '../../shared/network-failure'

const API = 'https://api.vercel.com'

/**
 * One Vercel project holds every sandbox, and everything in it belongs to the person who connected
 * it. Sandboxes from older builds still carry an `owner` tag; it is ignored. New connections get the fork's project; a connection saved with the upstream-named project
 * keeps it, so its sandboxes and snapshots stay reachable without a migration.
 */
export const SANDBOX_PROJECT = `${FORK_CLI_COMMAND_NAME}-sandboxes`
export const LEGACY_SANDBOX_PROJECT = 'orca-sandboxes'

const ErrorResponse = z.object({ error: z.object({ message: z.string() }) })

export class VercelApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export async function vercelApi(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  let response: Response
  let text: string
  try {
    response = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20_000)
    })
    text = await response.text()
  } catch (error) {
    // "fetch failed" or a timeout: say what it means and what to do.
    throw new Error(unreachableServiceMessage('Vercel'), { cause: error })
  }
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // A proxy or captive-portal page instead of Vercel's JSON.
    if (response.ok) {
      throw new Error(unreachableServiceMessage('Vercel'))
    }
  }
  if (!response.ok) {
    const parsed = ErrorResponse.safeParse(json)
    throw new VercelApiError(
      response.status,
      response.status === 429
        ? 'Vercel is limiting requests right now. Wait a minute, then try again.'
        : parsed.success
          ? parsed.data.error.message
          : `Vercel answered ${response.status}`
    )
  }
  return json
}

const UserResponse = z.object({
  user: z.object({
    username: z.string(),
    defaultTeamId: z.string().nullable().optional()
  })
})

const TeamsResponse = z.object({
  teams: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string().nullable().optional(),
      billing: z.object({ plan: z.string() }).nullable().optional()
    })
  )
})

export async function fetchVercelUser(
  token: string
): Promise<{ username: string; defaultTeamId: string | null }> {
  const { user } = UserResponse.parse(await vercelApi(token, '/v2/user'))
  return { username: user.username, defaultTeamId: user.defaultTeamId ?? null }
}

export async function fetchVercelTeams(token: string): Promise<VercelTeamSummary[]> {
  const { teams } = TeamsResponse.parse(await vercelApi(token, '/v2/teams?limit=50'))
  return teams.map((team) => ({
    id: team.id,
    slug: team.slug,
    name: team.name ?? team.slug,
    plan: team.billing?.plan ?? 'hobby'
  }))
}

const TokenResponse = z.object({
  token: z.object({ expiresAt: z.number().nullable().optional() })
})

/** A pasted token's expiry, when Vercel states one; null when it does not or cannot say. */
export async function fetchVercelTokenExpiry(token: string): Promise<number | null> {
  try {
    const parsed = TokenResponse.safeParse(await vercelApi(token, '/v5/user/tokens/current'))
    return parsed.success ? (parsed.data.token.expiresAt ?? null) : null
  } catch {
    return null
  }
}

/**
 * Finds the sandbox project in the team, creating it on first connect. `savedProjectId` is the
 * project this connection already used in the same team; it is kept while it still exists.
 */
export async function ensureSandboxProject(
  token: string,
  teamId: string,
  savedProjectId?: string | null
): Promise<string> {
  const team = `teamId=${encodeURIComponent(teamId)}`
  if (savedProjectId && savedProjectId !== SANDBOX_PROJECT) {
    try {
      await vercelApi(token, `/v9/projects/${encodeURIComponent(savedProjectId)}?${team}`)
      return savedProjectId
    } catch (error) {
      if (!(error instanceof VercelApiError) || error.status !== 404) {
        throw error
      }
    }
  }
  try {
    await vercelApi(token, `/v9/projects/${SANDBOX_PROJECT}?${team}`)
  } catch (error) {
    if (!(error instanceof VercelApiError) || error.status !== 404) {
      throw error
    }
    await vercelApi(token, `/v11/projects?${team}`, {
      method: 'POST',
      body: { name: SANDBOX_PROJECT }
    })
  }
  return SANDBOX_PROJECT
}
