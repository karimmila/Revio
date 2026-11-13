import { afterEach, describe, expect, it } from 'vitest'
import {
  getGithubAppAuthProvider,
  GIT_TOKEN_ENV,
  githubCredentialGitEnv,
  setGithubAppAuthProvider,
  withGithubAppGitCredentials
} from './github-app-auth'

const TOKEN = 'ghu_secret_token'
const original = getGithubAppAuthProvider()

afterEach(() => setGithubAppAuthProvider(original))

function configEntries(env: NodeJS.ProcessEnv): [string, string][] {
  const count = Number(env.GIT_CONFIG_COUNT)
  return Array.from({ length: count }, (_, i) => [
    env[`GIT_CONFIG_KEY_${i}`] ?? '',
    env[`GIT_CONFIG_VALUE_${i}`] ?? ''
  ])
}

describe('git credentials from the GitHub App token', () => {
  it('replaces the app host helpers with one that reads the token from the env only', () => {
    const env = githubCredentialGitEnv({ PATH: '/usr/bin' }, 'github.com', TOKEN)

    expect(configEntries(env)).toEqual([
      ['credential.https://github.com.helper', ''],
      ['credential.https://github.com.helper', expect.stringContaining(`$${GIT_TOKEN_ENV}`)]
    ])
    expect(env[GIT_TOKEN_ENV]).toBe(TOKEN)
    // The token lives in exactly one env var: never in a config value (hooks can print config)
    // and never in argv.
    const carriers = Object.entries(env).filter(([, value]) => value?.includes(TOKEN))
    expect(carriers).toEqual([[GIT_TOKEN_ENV, TOKEN]])
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
  })

  it('appends after config entries the caller already set', () => {
    const env = githubCredentialGitEnv(
      { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.askPass', GIT_CONFIG_VALUE_0: '' },
      'github.com',
      TOKEN
    )
    expect(env.GIT_CONFIG_COUNT).toBe('3')
    expect(env.GIT_CONFIG_KEY_0).toBe('core.askPass')
    expect(env.GIT_CONFIG_KEY_1).toBe('credential.https://github.com.helper')
  })

  it('signed out: clears the keychain-backed helpers and supplies nothing', () => {
    const env = githubCredentialGitEnv({ [GIT_TOKEN_ENV]: 'stale' }, 'github.com', null)
    expect(configEntries(env)).toEqual([['credential.https://github.com.helper', '']])
    expect(env[GIT_TOKEN_ENV]).toBeUndefined()
  })

  it('leaves the env alone before a provider is registered', () => {
    setGithubAppAuthProvider(null)
    const env = { PATH: '/usr/bin' }
    expect(withGithubAppGitCredentials(env)).toBe(env)
  })

  it('uses the in-memory token of the registered provider', () => {
    setGithubAppAuthProvider({
      host: () => 'github.com',
      login: () => 'octo',
      token: async () => TOKEN,
      peekToken: () => TOKEN,
      coverage: async () => 'covered'
    })
    expect(withGithubAppGitCredentials({})[GIT_TOKEN_ENV]).toBe(TOKEN)
  })
})
