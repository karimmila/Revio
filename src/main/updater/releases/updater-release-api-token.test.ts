import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGithubAppAuthProvider,
  GithubAppSignInRequiredError,
  setGithubAppAuthProvider,
  type GithubAppAuthProvider
} from '../../git/command-runner/github-app-auth'

const { ghExecMock } = vi.hoisted(() => ({ ghExecMock: vi.fn() }))
vi.mock('../../git/command-runner/gh-exec-file', () => ({
  ghExecFileWithScopeAsync: ghExecMock,
  ghExecFileAsync: ghExecMock
}))

const { _resetReleaseApiTokenCache, rejectReleaseApiToken, resolveReleaseApiToken } =
  await import('./updater-release-api-token')

const T0 = 1_000_000
const TTL_MS = 5 * 60_000
const original = getGithubAppAuthProvider()

function provider(token: () => Promise<string>, host = 'github.com'): GithubAppAuthProvider {
  return {
    host: () => host,
    login: () => 'octo',
    token,
    peekToken: () => null,
    coverage: async () => 'covered'
  }
}

describe('resolveReleaseApiToken', () => {
  beforeEach(() => _resetReleaseApiTokenCache())
  afterEach(() => setGithubAppAuthProvider(original))

  it('uses the GitHub App token, never gh auth token', async () => {
    setGithubAppAuthProvider(provider(async () => 'ghu_app'))
    await expect(resolveReleaseApiToken(T0)).resolves.toEqual({
      token: 'ghu_app',
      rateLimitScope: 'native:github.com'
    })
    expect(ghExecMock).not.toHaveBeenCalled()
  })

  it('goes unauthenticated while signed out, and re-reads after the TTL', async () => {
    const token = vi.fn(async (): Promise<string> => {
      throw new GithubAppSignInRequiredError()
    })
    setGithubAppAuthProvider(provider(token))
    await expect(resolveReleaseApiToken(T0)).resolves.toBeNull()
    await expect(resolveReleaseApiToken(T0 + TTL_MS - 1)).resolves.toBeNull()
    expect(token).toHaveBeenCalledTimes(1)

    token.mockResolvedValueOnce('ghu_new')
    await expect(resolveReleaseApiToken(T0 + TTL_MS + 1)).resolves.toMatchObject({
      token: 'ghu_new'
    })
  })

  it('has no token for an app on another host', async () => {
    setGithubAppAuthProvider(provider(async () => 'ghu_app', 'ghe.example.com'))
    await expect(resolveReleaseApiToken(T0)).resolves.toBeNull()
  })

  it('goes unauthenticated for a TTL after the token is rejected', async () => {
    setGithubAppAuthProvider(provider(async () => 'ghu_stale'))
    await expect(resolveReleaseApiToken(T0)).resolves.toMatchObject({ token: 'ghu_stale' })
    rejectReleaseApiToken(T0 + 1)
    await expect(resolveReleaseApiToken(T0 + 2)).resolves.toBeNull()
  })
})
