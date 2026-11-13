import { describe, expect, it } from 'vitest'
import {
  githubAppInstallUrl,
  githubAppOverrideProblem,
  githubAuthorizationsUrl,
  resolveGithubAppConfig
} from './github-app-config'

const shipped = { clientId: 'Iv23liAbCdEf0123456789', slug: 'revio', host: 'github.com' }

describe('GitHub App config', () => {
  it('treats the TBD placeholder as not configured', () => {
    const config = resolveGithubAppConfig({ clientId: 'TBD', slug: 'TBD', host: 'github.com' })
    expect(config.configured).toBe(false)
    if (!config.configured) {
      expect(config.message).toMatch(/no GitHub App configured/)
    }
  })

  it('derives the web and API bases for github.com and GHES', () => {
    const dotCom = resolveGithubAppConfig(shipped)
    expect(dotCom).toMatchObject({
      configured: true,
      webBase: 'https://github.com',
      apiBase: 'https://api.github.com',
      custom: false
    })
    const ghes = resolveGithubAppConfig(shipped, { host: ' GitHub.Example.com ' })
    expect(ghes).toMatchObject({
      configured: true,
      host: 'github.example.com',
      webBase: 'https://github.example.com',
      apiBase: 'https://github.example.com/api/v3',
      custom: true
    })
  })

  it('lets an override fill in a placeholder build', () => {
    const config = resolveGithubAppConfig(
      { clientId: 'TBD', slug: 'TBD', host: 'github.com' },
      { clientId: 'Iv1.0123456789abcdef', slug: 'my-app' }
    )
    expect(config).toMatchObject({ configured: true, clientId: 'Iv1.0123456789abcdef' })
  })

  it('refuses invalid overrides', () => {
    expect(githubAppOverrideProblem({ clientId: 'TBD' })).toMatch(/client ID/)
    expect(githubAppOverrideProblem({ clientId: 'a b' })).toMatch(/client ID/)
    expect(githubAppOverrideProblem({ slug: 'My App' })).toMatch(/App name/)
    expect(githubAppOverrideProblem({ host: 'https://github.com' })).toMatch(/host name/)
    expect(githubAppOverrideProblem({ host: 'localhost' })).toMatch(/host name/)
    expect(githubAppOverrideProblem({ clientId: '', slug: ' ', host: '' })).toBeNull()
    expect(resolveGithubAppConfig(shipped, { host: 'not a host' }).configured).toBe(false)
  })

  it('builds install and authorization URLs', () => {
    const config = { webBase: 'https://github.com', slug: 'revio', host: 'github.com' }
    expect(githubAppInstallUrl(config)).toBe('https://github.com/apps/revio/installations/new')
    expect(githubAppInstallUrl(config, 42)).toBe(
      'https://github.com/apps/revio/installations/new/permissions?target_id=42'
    )
    expect(githubAppInstallUrl(config, -1)).toBe('https://github.com/apps/revio/installations/new')
    expect(
      githubAppInstallUrl({ webBase: 'https://ghe.acme.io', slug: 'revio', host: 'ghe.acme.io' })
    ).toBe('https://ghe.acme.io/github-apps/revio/installations/new')
    expect(githubAuthorizationsUrl(config)).toBe('https://github.com/settings/apps/authorizations')
  })
})
