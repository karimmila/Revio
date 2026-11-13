import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('@/lib/cloud-workspaces', () => ({ cloudEnvironmentIdsNow: vi.fn(), isCloudRepo: vi.fn() }))
const git = vi.hoisted(() => ({
  status: vi.fn(async (): Promise<{ entries: unknown[] }> => ({ entries: [] })),
  compare: vi.fn(async (): Promise<{ summary: Record<string, unknown> }> => ({
    summary: { status: 'ready', changedFiles: 0, commitsAhead: 0 }
  }))
}))
vi.mock('@/runtime/runtime-git-status-client', () => ({ getRuntimeGitStatus: git.status }))
vi.mock('@/runtime/runtime-git-diff-client', () => ({ getRuntimeGitBranchCompare: git.compare }))
vi.mock('@/lib/resolve-owner', () => ({
  runtimeTargetForWorkspaceOwner: () => ({ kind: 'local' })
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))
vi.mock('@/lib/claude-login-route-store', () => ({ refreshClaudeLoginRoute: async () => 'system' }))

import type { CloudGithubStatus } from '../../../../shared/cloud/cloud-types'
import { useAppStore } from '@/store'
import {
  createPrBlock,
  createPrBlockMessage,
  readCreatePrBlock,
  remoteOnAppHost,
  type CreatePrFacts
} from './revio-create-pr-precheck'

function github(patch: Partial<CloudGithubStatus> = {}): CloudGithubStatus {
  return {
    app: {
      configured: true,
      host: 'github.com',
      slug: 'revio',
      custom: false,
      authorizationsUrl: 'https://github.com/settings/apps/authorizations'
    },
    account: { login: 'octo' },
    signInExpired: false,
    signIn: null,
    repos: [],
    pendingInstallOwner: null,
    coverageError: null,
    migrated: false,
    ...patch
  }
}

function facts(patch: Partial<CreatePrFacts> = {}): CreatePrFacts {
  return {
    repoId: 'repo-1',
    usesAgent: true,
    localClaudeChat: true,
    claudeRoute: 'system',
    github: github(),
    remoteOnAppHost: true,
    slug: { owner: 'acme', name: 'app' },
    uncommitted: 2,
    compare: { status: 'ready', changedFiles: 1, commitsAhead: 1 },
    ...patch
  }
}

describe('createPrBlock', () => {
  it('lets a ready workspace through', () => {
    expect(createPrBlock(facts())).toBeNull()
  })

  it('asks for the Claude sign-in before any chat starts', () => {
    expect(createPrBlock(facts({ claudeRoute: 'none' }))).toEqual({ kind: 'claude-sign-in' })
    // GitHub's own form needs no agent, and a cloud chat does not use this Mac's login.
    expect(createPrBlock(facts({ claudeRoute: 'none', usesAgent: false }))).toBeNull()
    expect(createPrBlock(facts({ claudeRoute: 'none', localClaudeChat: false }))).toBeNull()
  })

  it('says a repository with no GitHub remote needs one', () => {
    const block = createPrBlock(facts({ remoteOnAppHost: false, slug: null }))
    expect(block).toEqual({ kind: 'no-remote', repoId: 'repo-1' })
    expect(block && createPrBlockMessage(block)).toBe('Add a GitHub remote to open pull requests.')
  })

  it('asks to sign in with GitHub, or again once the sign-in expired', () => {
    expect(createPrBlock(facts({ github: github({ account: null }) }))).toEqual({
      kind: 'github-sign-in',
      expired: false
    })
    expect(
      createPrBlock(facts({ github: github({ account: null, signInExpired: true }) }))
    ).toEqual({ kind: 'github-sign-in', expired: true })
  })

  it('asks to install the app on the owner of an uncovered repository', () => {
    const repos = [
      {
        repoId: 'other-id',
        owner: 'Acme',
        name: 'app',
        state: 'not-covered' as const,
        installUrl: null
      }
    ]
    expect(createPrBlock(facts({ github: github({ repos }) }))).toEqual({
      kind: 'install-app',
      owner: 'Acme'
    })
  })

  it('says there is nothing to open a pull request for on a clean, level branch', () => {
    const clean = {
      uncommitted: 0,
      compare: { status: 'ready' as const, changedFiles: 0, commitsAhead: 0 }
    }
    expect(createPrBlock(facts(clean))).toEqual({ kind: 'no-changes' })
    expect(createPrBlock(facts({ ...clean, uncommitted: 1 }))).toBeNull()
  })

  it('never blocks on what it could not read', () => {
    expect(
      createPrBlock(
        facts({
          claudeRoute: null,
          github: null,
          remoteOnAppHost: null,
          uncommitted: 0,
          compare: { status: 'loading', changedFiles: 0 }
        })
      )
    ).toBeNull()
    expect(createPrBlock(facts({ uncommitted: 0, compare: null }))).toBeNull()
    // git could not say how many files changed: a level branch alone proves nothing.
    expect(
      createPrBlock(
        facts({
          uncommitted: null,
          compare: { status: 'ready', changedFiles: 0, commitsAhead: 0 }
        })
      )
    ).toBeNull()
    expect(
      createPrBlock(facts({ github: github({ app: { configured: false, message: 'none' } }) }))
    ).toBeNull()
  })
})

describe('remoteOnAppHost', () => {
  it('tells no remote from a remote that was not probed yet', () => {
    expect(remoteOnAppHost(undefined, null, github())).toBeNull()
    expect(remoteOnAppHost(null, null, github())).toBe(false)
    expect(remoteOnAppHost({ remoteUrl: 'git@gitlab.com:a/b.git' }, null, github())).toBe(false)
    expect(
      remoteOnAppHost({ remoteUrl: 'git@github.com:a/b.git' }, { owner: 'a', name: 'b' }, github())
    ).toBe(true)
  })
})

describe('readCreatePrBlock', () => {
  // The store as it is right after an agent wrote a file: no panel has loaded git status yet.
  function storeWith(gitStatusByWorktree: Record<string, unknown[]>): void {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the pre-check reads only the fields set here
    vi.mocked(useAppStore.getState).mockReturnValue({
      settings: { defaultTuiAgent: 'claude' },
      repos: [{ id: 'repo-1', kind: 'git', gitRemoteIdentity: undefined }],
      worktreesByRepo: {
        'repo-1': [{ id: 'w', repoId: 'repo-1', path: '/w', baseRef: 'origin/main' }]
      },
      gitStatusByWorktree,
      gitBranchCompareSummaryByWorktree: {
        w: { status: 'ready', changedFiles: 0, commitsAhead: 0, baseRef: 'origin/main' }
      }
    } as never)
    vi.stubGlobal('window', { api: { cloud: { githubStatus: async () => null } } })
  }

  it('asks git itself, so a file the agent just wrote is never "no changes"', async () => {
    const unloadedStores: Record<string, unknown[]>[] = [{}, { w: [] }]
    for (const unloaded of unloadedStores) {
      storeWith(unloaded)
      git.status.mockResolvedValueOnce({ entries: [{ path: 'notes.md' }] })
      expect(await readCreatePrBlock('w', true)).toBeNull()
    }
    expect(git.status).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'w', worktreePath: '/w' }),
      expect.anything()
    )
    vi.unstubAllGlobals()
  })

  it('does not trust a comparison loaded before the last commit', async () => {
    storeWith({ w: [] })
    git.status.mockResolvedValueOnce({ entries: [] })
    git.compare.mockResolvedValueOnce({
      summary: { status: 'ready', changedFiles: 1, commitsAhead: 1 }
    })
    expect(await readCreatePrBlock('w', true)).toBeNull()
    vi.unstubAllGlobals()
  })

  it('says no changes only when git reports a clean worktree on a level branch', async () => {
    storeWith({ w: [{ path: 'stale.ts' }] })
    git.status.mockResolvedValueOnce({ entries: [] })
    expect(await readCreatePrBlock('w', true)).toEqual({ kind: 'no-changes' })

    git.status.mockRejectedValueOnce(new Error('git failed'))
    expect(await readCreatePrBlock('w', true)).toBeNull()
    vi.unstubAllGlobals()
  })
})
