import { describe, expect, it } from 'vitest'
import {
  agentSetupStatus,
  claudeMacLoginStatus,
  githubSetupStatus,
  projectSetupStatus,
  vercelSetupStatus
} from './workspace-setup-status'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'

describe('claudeMacLoginStatus', () => {
  it('follows the launch rule: a managed account, an API key or Claude Code’s login all run', () => {
    expect(claudeMacLoginStatus('managed')).toBe('connected')
    expect(claudeMacLoginStatus('apiKey')).toBe('connected')
    expect(claudeMacLoginStatus('system')).toBe('connected')
  })

  it('asks for a sign-in only when no login exists', () => {
    expect(claudeMacLoginStatus('none')).toBe('not-connected')
  })

  it('is checking until the login is known', () => {
    expect(claudeMacLoginStatus(null)).toBe('checking')
  })
})

describe('agentSetupStatus', () => {
  it('is connected with either login', () => {
    expect(agentSetupStatus('connected', false)).toBe('connected')
    expect(agentSetupStatus('not-connected', true)).toBe('connected')
  })

  it('is checking until both are known', () => {
    expect(agentSetupStatus('not-connected', null)).toBe('checking')
    expect(agentSetupStatus('not-connected', false)).toBe('not-connected')
  })
})

describe('connection statuses', () => {
  it('needs a picked Vercel team', () => {
    expect(vercelSetupStatus(null)).toBe('checking')
    expect(
      vercelSetupStatus({ state: 'choose-team', via: 'oauth', username: 'a', teams: [] })
    ).toBe('not-connected')
  })

  it('needs a GitHub sign-in that reaches a project', () => {
    const status = (
      login: string | null,
      states: ('covered' | 'not-covered' | 'unknown')[]
    ): CloudGithubStatus => ({
      app: {
        configured: true,
        host: 'github.com',
        slug: 'app',
        custom: false,
        authorizationsUrl: ''
      },
      account: login ? { login } : null,
      signInExpired: false,
      signIn: null,
      repos: states.map((state, index) => ({
        repoId: `r${index}`,
        owner: 'acme',
        name: `app${index}`,
        state,
        installUrl: null
      })),
      pendingInstallOwner: null,
      coverageError: null,
      migrated: false
    })
    expect(githubSetupStatus(null)).toBe('checking')
    expect(githubSetupStatus(status(null, []))).toBe('not-connected')
    expect(githubSetupStatus(status('me', []))).toBe('connected')
    expect(githubSetupStatus(status('me', ['not-covered', 'covered']))).toBe('connected')
    expect(githubSetupStatus(status('me', ['not-covered', 'unknown']))).toBe('not-connected')
  })

  it('counts any added project', () => {
    expect(projectSetupStatus(0)).toBe('not-connected')
    expect(projectSetupStatus(2)).toBe('connected')
  })
})
