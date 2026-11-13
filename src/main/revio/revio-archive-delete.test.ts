import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { saveTurnCheckpoint } from '../git/checkpoints/turn-checkpoints'
import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'
import { deleteArchivedWorkspaceForGood } from './revio-archive-delete'
import {
  addArchivedWorkspace,
  readArchivedWorkspaces,
  removeArchivedWorkspace
} from './revio-archive-store'

let repo: string
let userData: string
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
// Checkpoints are saved under the app's own ref root, not the upstream one.
const REF_ROOT = `refs/${FORK_CLI_COMMAND_NAME}-checkpoints`
const archiveRefs = (): string[] =>
  git('for-each-ref', '--format=%(refname)', `${REF_ROOT}/`).split('\n').filter(Boolean)
const repoGit = (): { path: string; options: Record<string, never> } => ({
  path: repo,
  options: {}
})

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'orca-archive-delete-'))
  userData = mkdtempSync(join(tmpdir(), 'orca-archive-data-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
  writeFileSync(join(repo, 'a.txt'), 'one\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  git('branch', 'me/feature')
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
  rmSync(userData, { recursive: true, force: true })
})

const record = (id: string, archivedAt: number) => ({
  id,
  repoId: 'repo',
  displayName: 'Feature',
  branch: 'me/feature',
  archiveCommit: git('rev-parse', 'HEAD'),
  archivedAt,
  cloud: false,
  checkpointSession: `archive-${archivedAt}`
})

it('removes the checkpoint of every archive of a workspace archived twice, and keeps its branch', async () => {
  writeFileSync(join(repo, 'a.txt'), 'uncommitted\n')
  await saveTurnCheckpoint(repo, 'archive-1000', {}, 1000)
  addArchivedWorkspace(userData, record('repo::/work/feature', 1000))
  // Another workspace's archive, and a chat's checkpoint: neither is this workspace's.
  await saveTurnCheckpoint(repo, 'archive-1500', {}, 1500)
  addArchivedWorkspace(userData, record('repo::/work/other', 1500))
  await saveTurnCheckpoint(repo, 'session-1', {}, 1600)

  // Unarchive leaves the first checkpoint under its ref; the workspace is then archived again.
  removeArchivedWorkspace(userData, 'repo::/work/feature', 'repo::/work/feature')
  await saveTurnCheckpoint(repo, 'archive-2000', {}, 2000)
  addArchivedWorkspace(userData, record('repo::/work/feature', 2000))
  expect(readArchivedWorkspaces(userData)[0].earlierCheckpointSessions).toEqual(['archive-1000'])

  const removed = await deleteArchivedWorkspaceForGood(userData, 'repo::/work/feature', repoGit)
  expect(removed.map((entry) => entry.id)).toEqual(['repo::/work/feature'])
  expect(archiveRefs()).toEqual([`${REF_ROOT}/archive-1500/1500`, `${REF_ROOT}/session-1/1600`])
  expect(readArchivedWorkspaces(userData).map((entry) => entry.id)).toEqual(['repo::/work/other'])
  expect(git('branch', '--list', 'me/feature')).toContain('me/feature')
})

it('follows a workspace that came back under a new id, through an archive that saved nothing', async () => {
  await saveTurnCheckpoint(repo, 'archive-1000', {}, 1000)
  addArchivedWorkspace(userData, record('repo::/work/feature', 1000))
  removeArchivedWorkspace(userData, 'repo::/work/feature', 'repo::/work/feature-restored')
  const { checkpointSession: _none, ...withoutCheckpoint } = record(
    'repo::/work/feature-restored',
    2000
  )
  addArchivedWorkspace(userData, withoutCheckpoint)

  await deleteArchivedWorkspaceForGood(userData, 'repo::/work/feature-restored', repoGit)
  expect(archiveRefs()).toEqual([])
  expect(readArchivedWorkspaces(userData)).toEqual([])
})

it('deletes a cloud record without touching Git', async () => {
  await saveTurnCheckpoint(repo, 'archive-1000', {}, 1000)
  addArchivedWorkspace(userData, { ...record('repo::/cloud', 1000), cloud: true })
  let asked = 0
  await deleteArchivedWorkspaceForGood(userData, 'repo::/cloud', () => {
    asked += 1
    return repoGit()
  })
  expect(asked).toBe(0)
  expect(archiveRefs()).toEqual([`${REF_ROOT}/archive-1000/1000`])
})

it('removes the per-message checkpoints of the workspace’s chats, under both ref roots', async () => {
  const LEGACY_ROOT = 'refs/orca-checkpoints'
  const allRefs = (): string[] =>
    git('for-each-ref', '--format=%(refname)', `${REF_ROOT}/`, `${LEGACY_ROOT}/`)
      .split('\n')
      .filter(Boolean)
  writeFileSync(join(repo, 'a.txt'), 'uncommitted\n')
  // Two messages in one chat, one in a second chat, and a checkpoint an older build saved.
  await saveTurnCheckpoint(repo, 'claude_abc', {}, 1100)
  await saveTurnCheckpoint(repo, 'claude_abc', {}, 1200)
  await saveTurnCheckpoint(repo, 'codex_def', {}, 1300)
  const older = git('rev-parse', `${REF_ROOT}/claude_abc/1100`)
  git('update-ref', `${LEGACY_ROOT}/claude_abc/900`, older)
  // Another workspace's chat, and a chat whose id only starts the same way.
  await saveTurnCheckpoint(repo, 'claude_other', {}, 1400)
  await saveTurnCheckpoint(repo, 'claude_abcdef', {}, 1500)
  await saveTurnCheckpoint(repo, 'archive-1000', {}, 1000)
  addArchivedWorkspace(userData, {
    ...record('repo::/work/feature', 1000),
    chats: [
      { agent: 'claude', sessionId: 'claude_abc' },
      { agent: 'codex', sessionId: 'codex_def' },
      // A chat kept only by its provider id has no checkpoints of its own to find.
      { agent: 'claude', providerSessionId: 'provider-only' }
    ]
  })

  await deleteArchivedWorkspaceForGood(userData, 'repo::/work/feature', repoGit)

  expect(allRefs()).toEqual([`${REF_ROOT}/claude_abcdef/1500`, `${REF_ROOT}/claude_other/1400`])
  expect(readArchivedWorkspaces(userData)).toEqual([])
})
