import { describe, expect, it, vi } from 'vitest'

const { ghExecFileAsyncMock } = vi.hoisted(() => ({ ghExecFileAsyncMock: vi.fn() }))

vi.mock('../git/command-runner/gh-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ghExecFileAsync: ghExecFileAsyncMock
}))
import { diagnoseGhAuth, parseAuthStatus, parseRejectedAccounts } from './auth-diagnose'

describe('parseAuthStatus', () => {
  it('parses an env-shadowed login alongside a keyring login (real gh output)', () => {
    const text = `github.com
  ✓ Logged in to github.com account nwparker (GITHUB_TOKEN)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

  ✓ Logged in to github.com account nwparker (keyring)
  - Active account: false
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
`
    const accounts = parseAuthStatus(text)
    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toMatchObject({
      host: 'github.com',
      user: 'nwparker',
      active: true,
      envToken: 'GITHUB_TOKEN',
      source: 'env'
    })
    expect(accounts[0].scopes).toEqual(['gist', 'read:org', 'repo', 'workflow'])
    expect(accounts[1]).toMatchObject({
      active: false,
      envToken: null,
      source: 'keyring'
    })
  })

  it('parses a ported GHES auth-status section', () => {
    const text = `ghe.acme.io:8443
  ✓ Logged in to ghe.acme.io:8443 account bob (keyring)
  - Active account: true
  - Token scopes: 'project', 'repo'
`

    expect(parseAuthStatus(text)).toEqual([
      expect.objectContaining({ host: 'ghe.acme.io:8443', user: 'bob', active: true })
    ])
  })
})

describe('diagnoseGhAuth', () => {
  it('reports the GitHub App sign-in, without running gh auth status', async () => {
    const diag = await diagnoseGhAuth('GitHub.com')

    expect(diag.requiredHostAuthenticated).toBe(true)
    expect(diag.activeAccount).toMatchObject({ host: 'github.com', user: 'test-user' })
    expect(diag.missingScopes).toEqual([])
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('reports another host as unauthenticated', async () => {
    const diag = await diagnoseGhAuth('github.other-corp.com')

    expect(diag.requiredHost).toBe('github.other-corp.com')
    expect(diag.requiredHostAuthenticated).toBe(false)
    expect(diag.activeAccount).toBeNull()
  })
})

describe('parseRejectedAccounts', () => {
  it('names an account whose stored token GitHub refused', () => {
    const text = [
      'github.com',
      '  X Failed to log in to github.com account octocat (keyring)',
      '  - Active account: true',
      '  - The token in keyring is invalid.'
    ].join('\n')
    expect(parseRejectedAccounts(text)).toEqual([{ host: 'github.com', user: 'octocat' }])
  })

  it('finds none in a healthy status', () => {
    expect(
      parseRejectedAccounts('github.com\n  ✓ Logged in to github.com account octocat (keyring)')
    ).toEqual([])
  })
})
