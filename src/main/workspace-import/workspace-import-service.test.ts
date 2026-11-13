import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FsPromises from 'node:fs/promises'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'

const GUARDED_REPO = '/Users/someone/Desktop/web'

const mocks = vi.hoisted(() => {
  const workspaces: unknown[] = []
  const placed: string[] = []
  const added: string[] = []
  return { workspaces, placed, added }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  const readdir = async (path: string): Promise<string[]> => {
    if (path.startsWith('/Users/someone/Desktop')) {
      throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
    }
    return actual.readdir(path)
  }
  return { ...actual, default: { ...actual, readdir }, readdir }
})
vi.mock('../ipc/repos/local-repo-registration', () => ({
  addLocalRepoFromPath: async (_store: unknown, path: string) => {
    mocks.added.push(path)
    return { repo: { id: `repo:${path}`, path, kind: 'git' } }
  }
}))
vi.mock('../ipc/repos/repos-changed-notification', () => ({ notifyReposChanged: () => undefined }))
vi.mock('../ipc/worktrees/removal/registered-worktree-roots-cache', () => ({
  invalidateAuthorizedRootsCache: () => undefined
}))
vi.mock('./import-source-database', () => ({
  importSourceDataDir: () => '/source-data',
  importSourceCloudMirrorDir: () => '/source-mirrors',
  openImportSourceSnapshot: () => ({
    workspaces: mocks.workspaces,
    readChatMessages: () => [],
    close: () => undefined
  })
}))
vi.mock('./import-source-transcripts', () => ({ importSourceClaudeHome: () => '/claude-home' }))
vi.mock('./workspace-import-scripts', () => ({
  applyImportSourceScripts: () => undefined,
  approvedImportSourceScripts: async () => null
}))
vi.mock('./workspace-import-worktree', () => ({
  worktreeNameSeed: () => 'imported',
  placeImportedWorkspace: async (_ctx: unknown, repo: { id: string }, source: { name: string }) => {
    mocks.placed.push(source.name)
    return { worktreeId: `${repo.id}::/worktrees/${source.name}`, path: '/w', changes: 'none' }
  }
}))
vi.mock('./workspace-import-chat-transcript', () => ({
  importChatWithTranscript: async () => ({ ok: true, sessionId: 'chat' })
}))
vi.mock('./workspace-import-cloud-asleep', () => ({
  ASLEEP_CLOUD_LEDGER_PREFIX: 'asleep-cloud:',
  addChatToAsleepCloudWorkspace: async () => ({ ok: false, reason: 'chat-failed' }),
  asleepCloudIdOfLedgerEntry: () => null,
  placeAsleepCloudWorkspace: async () => null
}))

import { runWorkspaceImport, type WorkspaceImportServiceDeps } from './workspace-import-service'

function workspace(name: string, repoRootPath: string): ImportSourceWorkspace {
  return {
    sourceId: name,
    repoName: 'web',
    repoRemoteUrl: null,
    repoRootPath,
    name,
    path: join(repoRootPath, '..', 'workspaces', name),
    branch: `me/${name}`,
    baseBranch: 'main',
    archived: false,
    cloud: false,
    mirrorPath: null,
    lastActivityAt: '2026-11-01T00:00:00Z',
    chats: []
  }
}

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-service-'))
  mocks.placed.length = 0
  mocks.added.length = 0
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('workspace import run', () => {
  it('skips a workspace whose folder macOS refuses and still imports the others', async () => {
    const readable = join(root, 'code', 'api')
    mocks.workspaces = [workspace('guarded', GUARDED_REPO), workspace('open', readable)]
    const commonDirCalls: string[] = []
    // Only the stubs the run reaches; a real Store and runtime need Electron.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the run reads only the members set here
    const deps = {
      store: { getRepos: () => [] },
      mainWindow: {},
      runtime: { resolveStructuredAgentAccountHome: async () => null },
      git: {
        commonDir: async (path: string) => {
          commonDirCalls.push(path)
          return path === readable ? join(readable, '.git') : null
        },
        hasLocalBranch: async () => false,
        fetchRemoteBranch: async () => false
      },
      userDataDir: root
    } as unknown as WorkspaceImportServiceDeps

    const result = await runWorkspaceImport(
      deps,
      { includeArchived: false, includeScripts: true },
      () => undefined
    )

    expect(result.skipped).toEqual([
      { name: 'guarded', reason: 'folder-access-denied', folder: GUARDED_REPO }
    ])
    expect(result.workspaces).toBe(1)
    expect(mocks.placed).toEqual(['open'])
    expect(mocks.added).toEqual([readable])
    // The refused folder is not handed to git or to any later, blocking read.
    expect(commonDirCalls.filter((path) => path.startsWith('/Users/someone/Desktop'))).toEqual([])
  })
})
