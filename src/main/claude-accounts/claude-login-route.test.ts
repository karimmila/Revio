import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { CLAUDE_SIGN_IN_REQUIRED_MESSAGE } from '../../shared/claude-sign-in-required'
import { chooseClaudeLoginRoute } from '../../shared/claude-login-route'
import { resolveClaudeStructuredInvocation } from '../claude/structured/launch/claude-structured-launch-resolution'
import { prepareLocalCommitMessageAgentEnv } from '../text-generation/commit-message-agent-environment'
import { installClaudeProfileRouter } from './claude-profile-installed-router'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'
import { claudeStructuredAuthPolicyForSettings } from './claude-structured-auth-policy'
import { hasClaudeApiKeyEnv, hasClaudeSystemLogin } from './claude-system-login'
import { claudeKeychainService } from './keychain'

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'claude-login-route-'))
  roots.push(root)
  return root
}

type Scenario = {
  /** A Claude account signed in through the app and selected. */
  managed?: boolean
  systemLogin?: boolean
  env?: NodeJS.ProcessEnv
}

function workspaceLayout({ managed = false, systemLogin = false, env = {} }: Scenario) {
  const root = tempRoot()
  const account: ClaudeManagedAccount = {
    id: 'a',
    email: 'a@example.test',
    authMethod: 'subscription-oauth',
    managedAuthPath: '/unused-legacy',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
  const settings: ClaudeProfileRouterSettings & Pick<GlobalSettings, 'agentDefaultEnv'> = {
    claudeManagedAccounts: managed ? [account] : [],
    activeClaudeManagedAccountId: managed ? 'a' : null,
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: [],
    revioLayout: true
  }
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot: join(root, 'data'),
    userHome: join(root, 'personal'),
    env,
    runSetup: async () => ({ outcome: 'prepared', warnings: [], surfaces: {} }),
    hasSystemLogin: async () => systemLogin
  })
  if (managed) {
    const home = router.accountHome('a')
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, '..', 'profile.json'), '{}')
    writeFileSync(
      join(home, '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: 'a@example.test' } })
    )
  }
  installClaudeProfileRouter(router)
  return { router, settings }
}

function chat(settings: ClaudeProfileRouterSettings, env: Record<string, string> = {}) {
  return resolveClaudeStructuredInvocation({
    resolveCommand: () => ({ command: 'claude', prefixArgs: [] }),
    resolveInheritedEnv: async () => ({ PATH: '/usr/bin', ...env }),
    resolveAuthPolicy: () => claudeStructuredAuthPolicyForSettings(settings)
  })
}

describe('chooseClaudeLoginRoute', () => {
  const none = { managedAccount: false, provider: false, apiKey: false, systemLogin: false }
  it('prefers an app-managed account over every fallback', () => {
    expect(
      chooseClaudeLoginRoute({
        managedAccount: true,
        provider: true,
        apiKey: true,
        systemLogin: true
      })
    ).toBe('managed')
  })
  it('falls back to an API key or provider, then Claude Code’s own login', () => {
    expect(chooseClaudeLoginRoute({ ...none, apiKey: true, systemLogin: true })).toBe('apiKey')
    expect(chooseClaudeLoginRoute({ ...none, provider: true })).toBe('apiKey')
    expect(chooseClaudeLoginRoute({ ...none, systemLogin: true })).toBe('system')
  })
  it('asks for a sign-in only when nothing can run Claude', () => {
    expect(chooseClaudeLoginRoute(none)).toBe('none')
  })
})

describe('Claude in the workspace layout', () => {
  it('uses the managed account when one is signed in', async () => {
    const { router, settings } = workspaceLayout({ managed: true, systemLogin: true })
    expect(await router.login.route()).toBe('managed')
    expect(await router.login.requiresSignIn()).toBe(false)
    expect((await chat(settings)).account).toBe('managed')
  })

  it('falls back to Claude Code’s own login when no account is signed in', async () => {
    const { router, settings } = workspaceLayout({ systemLogin: true })
    expect(await router.login.route()).toBe('system')
    expect(await router.login.requiresSignIn()).toBe(false)
    expect((await chat(settings)).account).toBe('system')
    expect(await prepareLocalCommitMessageAgentEnv('claude', undefined)).toEqual({ ok: true })
  })

  it('falls back to ANTHROPIC_API_KEY when no account or login exists', async () => {
    const { router, settings } = workspaceLayout({ env: { ANTHROPIC_API_KEY: 'sk-test' } })
    expect(await router.login.route()).toBe('apiKey')
    expect(await router.login.requiresSignIn()).toBe(false)
    const invocation = await chat(settings, { ANTHROPIC_API_KEY: 'sk-test' })
    expect(invocation.env.ANTHROPIC_API_KEY).toBe('sk-test')
  })

  it('counts a key set in the agent environment settings', async () => {
    const { router, settings } = workspaceLayout({})
    settings.agentDefaultEnv = { claude: { ANTHROPIC_API_KEY: 'sk-settings' } }
    expect(await router.login.route()).toBe('apiKey')
  })

  it('prompts with both ways in when nothing can run Claude', async () => {
    const { router, settings } = workspaceLayout({})
    expect(await router.login.route()).toBe('none')
    expect(await router.login.requiresSignIn()).toBe(true)
    await expect(chat(settings)).rejects.toMatchObject({
      message: CLAUDE_SIGN_IN_REQUIRED_MESSAGE,
      reason: 'notSignedIn'
    })
    expect(await prepareLocalCommitMessageAgentEnv('claude', undefined)).toEqual({
      ok: false,
      error: CLAUDE_SIGN_IN_REQUIRED_MESSAGE
    })
    expect(CLAUDE_SIGN_IN_REQUIRED_MESSAGE).toMatch(/Sign in to Claude/)
    expect(CLAUDE_SIGN_IN_REQUIRED_MESSAGE).toMatch(/run claude in a terminal and log in/)
  })

  it('never prompts outside the workspace layout', async () => {
    const { router, settings } = workspaceLayout({})
    settings.revioLayout = false
    expect(await router.login.requiresSignIn()).toBe(false)
  })
})

describe('hasClaudeSystemLogin', () => {
  it('finds the credentials file in the default config folder', async () => {
    const userHome = tempRoot()
    const exists = async (): Promise<boolean> => false
    const deps = {
      env: {},
      userHome,
      platform: 'linux' as const,
      keychainItemExists: exists,
      authStatus: async () => null
    }
    expect(await hasClaudeSystemLogin(deps)).toBe(false)
    mkdirSync(join(userHome, '.claude'))
    writeFileSync(join(userHome, '.claude', '.credentials.json'), '{}')
    expect(await hasClaudeSystemLogin(deps)).toBe(true)
  })

  it('checks Claude Code’s Keychain item on macOS, named after CLAUDE_CONFIG_DIR', async () => {
    const userHome = tempRoot()
    const asked: string[] = []
    const exists = async (service: string): Promise<boolean> => {
      asked.push(service)
      return service === 'Claude Code-credentials'
    }
    const authStatus = async (): Promise<boolean | null> => true
    expect(
      await hasClaudeSystemLogin({
        env: {},
        userHome,
        platform: 'darwin',
        keychainItemExists: exists,
        authStatus
      })
    ).toBe(true)
    const custom = join(userHome, 'custom-claude')
    expect(
      await hasClaudeSystemLogin({
        env: { CLAUDE_CONFIG_DIR: custom },
        userHome,
        platform: 'darwin',
        keychainItemExists: exists,
        authStatus
      })
    ).toBe(false)
    // The temp folder's /private alias is asked too; the spelled path always comes first.
    expect(asked.slice(0, 2)).toEqual(['Claude Code-credentials', claudeKeychainService(custom)])
  })

  it('trusts `claude auth status` over a Keychain item that outlived its login', async () => {
    const deps = {
      env: {},
      userHome: tempRoot(),
      platform: 'darwin' as const,
      keychainItemExists: async () => true
    }
    expect(await hasClaudeSystemLogin({ ...deps, authStatus: async () => false })).toBe(false)
    expect(await hasClaudeSystemLogin({ ...deps, authStatus: async () => true })).toBe(true)
    // A CLI that cannot answer leaves the stored item as the evidence.
    expect(await hasClaudeSystemLogin({ ...deps, authStatus: async () => null })).toBe(true)
  })

  it('accepts a long-lived Claude Code OAuth token in the environment', async () => {
    expect(
      await hasClaudeSystemLogin({
        env: { CLAUDE_CODE_OAUTH_TOKEN: 'token' },
        userHome: tempRoot(),
        platform: 'linux'
      })
    ).toBe(true)
  })

  it('reads API keys and tokens, ignoring blank values', () => {
    expect(hasClaudeApiKeyEnv({ ANTHROPIC_API_KEY: 'sk' })).toBe(true)
    expect(hasClaudeApiKeyEnv({ ANTHROPIC_AUTH_TOKEN: 'tok' })).toBe(true)
    expect(hasClaudeApiKeyEnv({ ANTHROPIC_API_KEY: ' ' })).toBe(false)
    expect(hasClaudeApiKeyEnv(undefined)).toBe(false)
  })
})
