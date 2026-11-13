import { describe, expect, it } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'
import {
  chooseBranchSource,
  chooseImportProject,
  type WorkspaceImportGit
} from './workspace-import-project'

function repo(id: string, path: string, remoteUrl: string | null): Repo {
  const row: Repo = {
    id,
    path,
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    gitRemoteIdentity: remoteUrl
      ? { canonicalKey: remoteUrl, remoteName: 'origin', remoteUrl }
      : null
  }
  return row
}

const SOURCE: ImportSourceWorkspace = {
  sourceId: 'w1',
  repoName: 'web',
  repoRemoteUrl: 'https://github.com/acme/web.git',
  repoRootPath: '/src/web',
  name: 'Feature',
  path: '/other-app/web/oslo',
  branch: 'me/feature',
  baseBranch: 'main',
  archived: false,
  cloud: false,
  mirrorPath: null,
  lastActivityAt: null,
  chats: []
}

function fakeGit(
  commonDirs: Record<string, string>,
  branches: { local?: string[]; remote?: string[] } = {}
): WorkspaceImportGit {
  return {
    commonDir: async (path) => commonDirs[path] ?? null,
    hasLocalBranch: async (_repo, branch) => (branches.local ?? []).includes(branch),
    fetchRemoteBranch: async (_repo, branch) => (branches.remote ?? []).includes(branch)
  }
}

describe('chooseImportProject', () => {
  const mine = repo('mine', '/me/web', 'git@github.com:acme/web.git')
  const other = repo('other', '/me/web-2', 'git@github.com:acme/web.git')

  it('attaches a live worktree only to the clone it belongs to', async () => {
    const git = fakeGit({
      '/other-app/web/oslo': '/me/web-2/.git',
      '/me/web': '/me/web/.git',
      '/me/web-2': '/me/web-2/.git'
    })
    expect(await chooseImportProject(SOURCE, [mine, other], git)).toMatchObject({
      kind: 'existing',
      repo: { id: 'other' },
      attachWorktree: true
    })
  })

  it('adds the worktree’s own clone when no project shares it', async () => {
    const git = fakeGit({ '/other-app/web/oslo': '/src/web/.git', '/me/web': '/me/web/.git' })
    expect(await chooseImportProject(SOURCE, [mine], git)).toEqual({
      kind: 'add',
      path: '/src/web',
      attachWorktree: true
    })
  })

  it('makes a new worktree in a project on the same remote when the folder is gone', async () => {
    const git = fakeGit({ '/src/web': '/src/web/.git', '/me/web': '/me/web/.git' })
    expect(await chooseImportProject(SOURCE, [mine], git)).toMatchObject({
      kind: 'existing',
      repo: { id: 'mine' },
      attachWorktree: false
    })
    expect(await chooseImportProject(SOURCE, [], git)).toEqual({
      kind: 'add',
      path: '/src/web',
      attachWorktree: false
    })
    expect(await chooseImportProject(SOURCE, [], fakeGit({}))).toEqual({ kind: 'none' })
  })
})

describe('chooseBranchSource', () => {
  it('prefers the local branch, then the remote one, then a new branch', async () => {
    expect(await chooseBranchSource('/r', 'b', fakeGit({}, { local: ['b'], remote: ['b'] }))).toBe(
      'local'
    )
    expect(await chooseBranchSource('/r', 'b', fakeGit({}, { remote: ['b'] }))).toBe('remote')
    expect(await chooseBranchSource('/r', 'b', fakeGit({}))).toBe('new')
  })
})
