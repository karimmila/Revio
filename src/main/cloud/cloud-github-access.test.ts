import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetSecretStoreForTests, setSecretStore } from '../../shared/secret-store'

const root = vi.hoisted(() => ({ dir: '' }))
vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => root.dir }))
vi.mock('@vercel/sandbox', () => ({}))

import {
  forgetGithubCoverage,
  githubCoverageProblem,
  githubTokenForRepo
} from './cloud-github-access'
import { sandboxNetworkPolicy } from './cloud-network-policy'
import { saveGithubSession, signOutGithub } from './github-app-session'
import { currentGithubAppConfig } from './github-app-settings'

const repo = { owner: 'acme', name: 'example-repo' }

/** GitHub with one installation covering `repo`; a refresh hands out ghu_fresh. */
function github(covered: boolean): typeof fetch {
  return async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/login/oauth/access_token') {
      return Response.json({
        access_token: 'ghu_fresh',
        refresh_token: 'ghr_fresh',
        expires_in: 28_800,
        refresh_token_expires_in: 15_897_600
      })
    }
    if (url.pathname === '/user/installations') {
      return Response.json({
        total_count: 1,
        installations: [{ id: 1, account: { login: 'acme', id: 1 } }]
      })
    }
    if (url.pathname === '/user/installations/1/repositories') {
      return Response.json({
        total_count: covered ? 1 : 0,
        repositories: covered ? [{ name: repo.name, owner: { login: repo.owner } }] : []
      })
    }
    return new Response('{}', { status: 404 })
  }
}

// A fixed clock: expiry arithmetic must not depend on when the test runs.
const NOW = Date.UTC(2026, 10, 10, 12)

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  root.dir = mkdtempSync(join(tmpdir(), 'gh-access-'))
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (text) => Buffer.from(text),
    decryptString: (cipher) => cipher.toString('utf8'),
    describeProtectionGap: () => null
  })
  const config = currentGithubAppConfig()
  if (!config.configured) {
    throw new Error('the fork ships a configured GitHub App')
  }
  saveGithubSession(
    config,
    {
      accessToken: 'ghu_dying',
      refreshToken: 'ghr_old',
      accessExpiresAt: NOW + 60_000,
      refreshExpiresAt: NOW + 1e10
    },
    { login: 'acme', userId: 1 }
  )
  forgetGithubCoverage()
})

afterEach(() => {
  vi.useRealTimers()
  signOutGithub()
  rmSync(root.dir, { recursive: true, force: true })
  _resetSecretStoreForTests()
})

describe('GitHub access for cloud work', () => {
  it('hands the broker the refreshed token, never the dying one', async () => {
    const token = await githubTokenForRepo(repo, github(true))
    expect(token).toBe('ghu_fresh')
    const policy = sandboxNetworkPolicy(repo, token)
    const allow = typeof policy === 'object' ? policy.allow : undefined
    const headers = JSON.stringify(allow?.['api.github.com'])
    expect(headers).toContain('Bearer ghu_fresh')
    expect(headers).not.toContain('ghu_dying')
    const basic = Buffer.from('x-access-token:ghu_fresh').toString('base64')
    expect(JSON.stringify(allow?.['github.com'])).toContain(`Basic ${basic}`)
  })

  it('asks to install the app on an uncovered repository', async () => {
    await expect(githubTokenForRepo(repo, github(false))).rejects.toThrow(
      /Install the .+ GitHub App on acme and give it example-repo/
    )
    await expect(
      githubCoverageProblem(repo, { fetchImpl: github(true), force: true })
    ).resolves.toBeNull()
  })

  it('asks to sign in when signed out', async () => {
    signOutGithub()
    await expect(githubCoverageProblem(repo, { fetchImpl: github(true) })).resolves.toMatch(
      /Sign in with GitHub/
    )
  })
})
