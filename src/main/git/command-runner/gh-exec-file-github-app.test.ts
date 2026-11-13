import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('child_process', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  spawn: spawnMock
}))

import { fakeSpawnReturning } from '../../../shared/__fixtures__/fake-spawned-child'
import { _resetGhRateLimitBreaker } from '../gh-rate-limit-breaker'
import { ghExecFileAsync } from './gh-exec-file'
import {
  getGithubAppAuthProvider,
  GithubAppSignInRequiredError,
  GIT_TOKEN_ENV,
  setGithubAppAuthProvider,
  type GithubAppAuthProvider
} from './github-app-auth'

const TOKEN = 'ghu_app_token_value'
const original = getGithubAppAuthProvider()

function provider(overrides: Partial<GithubAppAuthProvider> = {}): GithubAppAuthProvider {
  return {
    host: () => 'github.com',
    login: () => 'octo',
    token: async () => TOKEN,
    peekToken: () => TOKEN,
    coverage: async () => 'covered',
    ...overrides
  }
}

function spawnedEnv(): NodeJS.ProcessEnv {
  const options: { env: NodeJS.ProcessEnv } = spawnMock.mock.calls[0][2]
  return options.env
}

beforeEach(() => {
  spawnMock.mockReset()
  spawnMock.mockImplementation(fakeSpawnReturning({ stdout: '[]' }))
})

afterEach(() => {
  setGithubAppAuthProvider(original)
  _resetGhRateLimitBreaker()
  vi.unstubAllEnvs()
})

describe('gh runs only with the GitHub App token', () => {
  it('passes GH_TOKEN, GH_HOST and GH_PROMPT_DISABLED, overriding inherited credentials', async () => {
    setGithubAppAuthProvider(provider())
    vi.stubEnv('GH_TOKEN', 'ambient-personal-token')
    vi.stubEnv('GITHUB_TOKEN', 'ambient-github-token')

    await ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'], {
      env: { ...process.env, GH_PROMPT_DISABLED: '' }
    })

    const env = spawnedEnv()
    expect(env.GH_TOKEN).toBe(TOKEN)
    expect(env.GH_HOST).toBe('github.com')
    expect(env.GH_PROMPT_DISABLED).toBe('1')
    expect(env.GITHUB_TOKEN).toBeUndefined()
    // gh's own git (pr checkout) reads the token from the env, never from the keychain.
    expect(env[GIT_TOKEN_ENV]).toBe(TOKEN)
    expect(spawnMock.mock.calls[0][1]).not.toContain(TOKEN)
  })

  it('uses GH_ENTERPRISE_TOKEN for an app on GitHub Enterprise Server', async () => {
    setGithubAppAuthProvider(provider({ host: () => 'ghe.acme.com' }))

    await ghExecFileAsync(['api', 'repos/acme/widgets/pulls'], { host: 'ghe.acme.com' })

    expect(spawnedEnv()).toMatchObject({ GH_HOST: 'ghe.acme.com', GH_ENTERPRISE_TOKEN: TOKEN })
  })

  it('never spawns while signed out', async () => {
    setGithubAppAuthProvider(
      provider({
        token: async () => {
          throw new GithubAppSignInRequiredError()
        }
      })
    )

    await expect(ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])).rejects.toMatchObject({
      code: 'REVIO_GITHUB_SIGN_IN_REQUIRED'
    })
    await expect(ghExecFileAsync(['api', 'user'])).rejects.toMatchObject({
      code: 'REVIO_GITHUB_SIGN_IN_REQUIRED'
    })
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('never spawns without a provider', async () => {
    setGithubAppAuthProvider(null)

    await expect(ghExecFileAsync(['api', 'rate_limit'])).rejects.toMatchObject({
      code: 'REVIO_GITHUB_SIGN_IN_REQUIRED'
    })
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it("inside a cloud sandbox runs gh with the sandbox's placeholder, never a real token", async () => {
    setGithubAppAuthProvider(null)
    vi.stubEnv('GH_TOKEN', 'github_pat_orca_placeholder_the_firewall_adds_the_real_token')

    await ghExecFileAsync(['api', 'repos/acme/widgets/pulls'])

    const env = spawnedEnv()
    expect(env.GH_TOKEN).toBe('github_pat_orca_placeholder_the_firewall_adds_the_real_token')
    expect(env.GH_PROMPT_DISABLED).toBe('1')
    expect(env[GIT_TOKEN_ENV]).toBeUndefined()
  })

  it('still refuses without a provider when an ordinary token is in the environment', async () => {
    setGithubAppAuthProvider(null)
    vi.stubEnv('GH_TOKEN', 'ghp_someones_personal_token')

    await expect(ghExecFileAsync(['api', 'repos/acme/widgets/pulls'])).rejects.toBeInstanceOf(
      GithubAppSignInRequiredError
    )
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('never spawns for a repository the app is not installed on, and names its owner', async () => {
    const coverage = vi.fn(async () => 'not-covered' as const)
    setGithubAppAuthProvider(provider({ coverage }))

    await expect(
      ghExecFileAsync(['pr', 'view', '7', '--repo', 'acme/widgets', '--json', 'state'])
    ).rejects.toMatchObject({ code: 'REVIO_GITHUB_APP_NOT_INSTALLED', owner: 'acme' })
    await expect(
      ghExecFileAsync(['api', 'repos/acme/widgets/commits/abc/check-runs'])
    ).rejects.toThrow(/Install .* on acme/)
    expect(coverage).toHaveBeenCalledWith('acme', 'widgets')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses gh auth commands, which read the keychain whatever the env says', async () => {
    setGithubAppAuthProvider(provider())

    await expect(ghExecFileAsync(['auth', 'status'])).rejects.toThrow(/gh auth/)
    await expect(ghExecFileAsync(['auth', 'token', '--hostname', 'github.com'])).rejects.toThrow()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses a host the app is not configured on', async () => {
    setGithubAppAuthProvider(provider())

    await expect(
      ghExecFileAsync(['api', 'repos/acme/widgets'], { host: 'ghe.other.com' })
    ).rejects.toMatchObject({ code: 'REVIO_GITHUB_SIGN_IN_REQUIRED' })
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
