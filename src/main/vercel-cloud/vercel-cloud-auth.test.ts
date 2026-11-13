import { beforeEach, expect, it, vi } from 'vitest'
import type { VercelCredentials } from './vercel-cloud-credentials'

const api = vi.hoisted(() => ({
  ensureSandboxProject: vi.fn(async () => 'orca-sandboxes'),
  fetchVercelTeams: vi.fn(),
  fetchVercelUser: vi.fn(async (): Promise<{ username: string; defaultTeamId: string | null }> => ({
    username: 'dev',
    defaultTeamId: 'team_company'
  })),
  fetchVercelTokenExpiry: vi.fn(async (): Promise<number | null> => null)
}))
const store = vi.hoisted((): { credentials: VercelCredentials | null } => ({ credentials: null }))

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))
const oauth = vi.hoisted(() => ({
  refreshToken: vi.fn(async (token: string) => {
    // One macrotask-free yield keeps the refresh in flight while a second caller arrives.
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)))
    return {
      access_token: `access-from-${token}`,
      refresh_token: `${token}-next`,
      expires_in: 3600
    }
  })
}))
vi.mock('@vercel/sandbox/dist/auth/index.js', () => ({
  OAuth: vi.fn(async () => oauth),
  isOAuthError: () => false
}))
vi.mock('./vercel-cloud-api', () => api)
vi.mock('./vercel-cloud-credentials', () => ({
  readVercelCredentials: () => store.credentials,
  writeVercelCredentials: (next: VercelCredentials) => {
    store.credentials = next
  },
  clearVercelCredentials: () => {
    store.credentials = null
  }
}))

import {
  connectVercelToken,
  freshCredentials,
  readVercelStatus,
  selectVercelTeam
} from './vercel-cloud-auth'

const personal = { id: 'team_personal', slug: 'dev', name: "dev's projects", plan: 'pro' }
const company = { id: 'team_company', slug: 'acme', name: 'Acme', plan: 'pro' }

beforeEach(() => {
  vi.clearAllMocks()
  store.credentials = null
})

it('reads a signed-in account without a team as choose-team and creates nothing', async () => {
  store.credentials = {
    accessToken: 'oauth',
    refreshToken: 'r',
    expiresAt: 9_999_999_999_000,
    teamId: null,
    projectId: null,
    kind: 'oauth'
  }
  api.fetchVercelTeams.mockResolvedValue([company, personal])
  const status = await readVercelStatus()
  expect(status).toMatchObject({ state: 'choose-team', teams: [company, personal] })
  expect(api.ensureSandboxProject).not.toHaveBeenCalled()
})

it('creates the project only in the team the person picks', async () => {
  store.credentials = {
    accessToken: 'oauth',
    refreshToken: 'r',
    expiresAt: 9_999_999_999_000,
    teamId: null,
    projectId: null,
    kind: 'oauth'
  }
  api.fetchVercelTeams.mockResolvedValue([company, personal])
  const status = await selectVercelTeam(personal.id)
  expect(api.ensureSandboxProject).toHaveBeenCalledWith('oauth', personal.id, null)
  expect(status).toMatchObject({ state: 'connected', team: personal, limits: { maxVcpus: 8 } })
})

it('keeps the saved project when the person picks the same team again', async () => {
  store.credentials = {
    accessToken: 'oauth',
    refreshToken: 'r',
    expiresAt: 9_999_999_999_000,
    teamId: personal.id,
    projectId: 'orca-sandboxes',
    kind: 'oauth'
  }
  api.fetchVercelTeams.mockResolvedValue([company, personal])
  await selectVercelTeam(personal.id)
  expect(api.ensureSandboxProject).toHaveBeenCalledWith('oauth', personal.id, 'orca-sandboxes')
  await selectVercelTeam(company.id)
  expect(api.ensureSandboxProject).toHaveBeenLastCalledWith('oauth', company.id, null)
})

it('refuses a token that reaches more than one team and writes nothing', async () => {
  api.fetchVercelTeams.mockResolvedValue([company, personal])
  await expect(connectVercelToken('a'.repeat(24))).rejects.toThrow(/more than one team/)
  expect(store.credentials).toBeNull()
  expect(api.ensureSandboxProject).not.toHaveBeenCalled()
})

it('connects a single-team token without refresh, in that team', async () => {
  api.fetchVercelTeams.mockResolvedValue([personal])
  api.fetchVercelTokenExpiry.mockResolvedValue(9_999_999_999_000)
  const status = await connectVercelToken(` ${'b'.repeat(24)} `)
  expect(store.credentials).toMatchObject({
    accessToken: 'b'.repeat(24),
    refreshToken: null,
    kind: 'token',
    teamId: personal.id
  })
  expect(status).toMatchObject({ state: 'connected', via: 'token', team: personal })
})

it('spends a refresh token once however many callers need fresh credentials', async () => {
  store.credentials = {
    accessToken: 'old',
    refreshToken: 'r1',
    expiresAt: 0,
    teamId: 'team_personal',
    projectId: 'orca-sandboxes',
    kind: 'oauth'
  }
  const results = await Promise.all([freshCredentials(), freshCredentials(), freshCredentials()])
  expect(oauth.refreshToken).toHaveBeenCalledTimes(1)
  expect(results.map((entry) => entry?.accessToken)).toEqual([
    'access-from-r1',
    'access-from-r1',
    'access-from-r1'
  ])
  expect(store.credentials?.refreshToken).toBe('r1-next')
})
