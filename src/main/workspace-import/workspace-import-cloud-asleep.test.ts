import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'

const sandboxCalls = vi.hoisted((): string[] => [])
vi.mock('@vercel/sandbox', () => {
  const record = (name: string) => () => {
    sandboxCalls.push(name)
    throw new Error('no sandbox at import')
  }
  return { Sandbox: { create: record('create'), get: record('get') }, Snapshot: {} }
})

import {
  addChatToAsleepCloudWorkspace,
  placeAsleepCloudWorkspace
} from './workspace-import-cloud-asleep'
import {
  asleepCloudPayloadDir,
  readAsleepCloudWorkspaces,
  removeAsleepCloudWorkspace
} from './asleep-cloud-store'
import { finishAsleepCloudWake, prepareAsleepCloudWake } from './asleep-cloud-wake'
import {
  markAsleepCloudPayloadApplied,
  readAsleepCloudPayloadManifest
} from './asleep-cloud-payload'
import { takeCloudRestore } from '../cloud/cloud-archive-restore'
import { importChangesScript, parseImportChanges } from '../cloud/cloud-import-payload'

let root: string
const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' }
  })

function makeRepo(path: string): void {
  mkdirSync(path, { recursive: true })
  run(path, 'init', '-q', '-b', 'main')
  run(path, 'config', 'user.email', 't@example.com')
  run(path, 'config', 'user.name', 't')
  writeFileSync(join(path, 'app.txt'), 'one\n')
  run(path, 'add', '.')
  run(path, 'commit', '-q', '-m', 'base')
}

function repoRow(path: string): Repo {
  return { id: 'repo-1', path, displayName: 'app', badgeColor: '#000', addedAt: 0 }
}

function source(mirrorPath: string | null): ImportSourceWorkspace {
  return {
    sourceId: 'w1',
    repoName: 'app',
    repoRemoteUrl: null,
    repoRootPath: null,
    name: 'Cloud feature',
    path: '/cloud/app/w1',
    branch: 'me/feature',
    baseBranch: 'main',
    archived: false,
    cloud: true,
    mirrorPath,
    lastActivityAt: '2026-11-10T10:00:00Z',
    chats: []
  }
}

const SNAPSHOT = {
  readChatMessages: () => [
    { role: 'user', content: 'hello there', createdAt: '2026-11-10T10:00:00Z' }
  ]
}

let userData: string
let origin: string
let clone: string
let mirror: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'asleep-cloud-'))
  sandboxCalls.length = 0
  userData = join(root, 'userData')
  origin = join(root, 'origin')
  makeRepo(origin)
  clone = join(root, 'clone')
  run(root, 'clone', '-q', origin, clone)
  mirror = join(root, 'mirror')
  run(root, 'clone', '-q', origin, mirror)
  run(mirror, 'config', 'user.email', 't@example.com')
  run(mirror, 'config', 'user.name', 't')
  // A commit GitHub never got, then uncommitted work on top of it.
  writeFileSync(join(mirror, 'app.txt'), 'one\nunpushed\n')
  run(mirror, 'commit', '-q', '-am', 'unpushed')
  writeFileSync(join(mirror, 'app.txt'), 'one\nunpushed\nuncommitted\n')
  writeFileSync(join(mirror, 'notes.md'), 'new file\n')
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('importing a cloud workspace asleep', () => {
  it('records it with its commit and keeps its work, without any sandbox call', async () => {
    const statusBefore = run(mirror, 'status', '--porcelain')
    const record = await placeAsleepCloudWorkspace({
      userDataDir: userData,
      repo: repoRow(clone),
      source: source(mirror),
      branch: 'me/feature'
    })
    expect(sandboxCalls).toEqual([])
    expect(record).toMatchObject({
      repoId: 'repo-1',
      displayName: 'Cloud feature',
      branch: 'me/feature',
      commit: run(mirror, 'rev-parse', 'HEAD').trim(),
      chats: []
    })
    expect(readAsleepCloudWorkspaces(userData)).toEqual([record])
    const dir = asleepCloudPayloadDir(userData, record?.id ?? '')
    expect(readAsleepCloudPayloadManifest(dir)).toEqual({
      sourceCwd: '/cloud/app/w1',
      patch: true,
      untracked: ['notes.md'],
      bundle: true
    })
    expect(readFileSync(join(dir, 'changes.patch'), 'utf8')).toContain('+uncommitted')
    expect(readFileSync(join(dir, 'new-files', 'notes.md'), 'utf8')).toBe('new file\n')
    // The bundle carries the unpushed commit and leaves no ref behind in the clone.
    expect(run(clone, 'bundle', 'list-heads', join(dir, 'commits.bundle'))).toContain(
      `refs/revio-import/${record?.id}`
    )
    expect(run(clone, 'for-each-ref', 'refs/revio-import')).toBe('')
    expect(run(mirror, 'status', '--porcelain')).toBe(statusBefore)
  })

  it('skips the bundle when GitHub already has the commit', async () => {
    run(mirror, 'push', '-q', 'origin', 'HEAD:refs/heads/me/feature')
    run(clone, 'fetch', '-q', 'origin')
    const record = await placeAsleepCloudWorkspace({
      userDataDir: userData,
      repo: repoRow(clone),
      source: source(mirror),
      branch: 'me/feature'
    })
    const dir = asleepCloudPayloadDir(userData, record?.id ?? '')
    expect(readAsleepCloudPayloadManifest(dir)?.bundle).toBe(false)
  })

  it('leaves a workspace without a mirror to the local import', async () => {
    expect(
      await placeAsleepCloudWorkspace({
        userDataDir: userData,
        repo: repoRow(clone),
        source: source(null),
        branch: 'me/feature'
      })
    ).toBeNull()
  })

  it('adds a chat once, with its rebuilt transcript', async () => {
    const record = await placeAsleepCloudWorkspace({
      userDataDir: userData,
      repo: repoRow(clone),
      source: source(mirror),
      branch: 'me/feature'
    })
    const id = record?.id ?? ''
    const from = { snapshot: SNAPSHOT, source: source(mirror), sourceHome: join(root, 'none') }
    const chat = {
      sourceId: 'c1',
      agent: 'claude' as const,
      providerSessionId: '11111111-2222-3333-4444-555555555555',
      title: 'Fix it',
      model: null,
      lastActivityAt: null
    }
    expect((await addChatToAsleepCloudWorkspace(userData, id, from, chat)).ok).toBe(true)
    expect((await addChatToAsleepCloudWorkspace(userData, id, from, chat)).ok).toBe(true)
    expect(readAsleepCloudWorkspaces(userData)[0]?.chats).toEqual([
      { agent: 'claude', providerSessionId: chat.providerSessionId, title: 'Fix it' }
    ])
    const transcript = readFileSync(
      join(asleepCloudPayloadDir(userData, id), 'transcripts', `${chat.providerSessionId}.jsonl`),
      'utf8'
    )
    expect(transcript).toContain('hello there')
    expect(transcript).toContain('"cwd":"/cloud/app/w1"')
    expect(
      (await addChatToAsleepCloudWorkspace(userData, id, from, { ...chat, agent: 'codex' })).ok
    ).toBe(false)
    removeAsleepCloudWorkspace(userData, id)
    expect((await addChatToAsleepCloudWorkspace(userData, id, from, chat)).ok).toBe(false)
  })
})

describe('waking it', () => {
  it('arms the next cloud create and deletes the Mac copy only after the sandbox took it', async () => {
    const record = await placeAsleepCloudWorkspace({
      userDataDir: userData,
      repo: repoRow(clone),
      source: source(mirror),
      branch: 'me/feature'
    })
    const id = record?.id ?? ''
    const dir = asleepCloudPayloadDir(userData, id)
    prepareAsleepCloudWake(userData, id)
    expect(takeCloudRestore('repo-1', 'me/feature')).toEqual({
      snapshotId: null,
      commit: record?.commit,
      importPayloadDir: dir
    })
    expect(finishAsleepCloudWake(userData, id)).toBeNull()
    expect(existsSync(dir)).toBe(true)
    expect(readAsleepCloudWorkspaces(userData)).toHaveLength(1)

    markAsleepCloudPayloadApplied(dir, 'applied')
    expect(finishAsleepCloudWake(userData, id)).toBe('applied')
    expect(existsSync(dir)).toBe(false)
    expect(readAsleepCloudWorkspaces(userData)).toEqual([])
    expect(() => prepareAsleepCloudWake(userData, id)).toThrow()
  })

  it('an outcome left by a failed wake does not count for the next wake', async () => {
    const record = await placeAsleepCloudWorkspace({
      userDataDir: userData,
      repo: repoRow(clone),
      source: source(mirror),
      branch: 'me/feature'
    })
    const id = record?.id ?? ''
    const dir = asleepCloudPayloadDir(userData, id)
    prepareAsleepCloudWake(userData, id)
    // The sandbox took the payload, then the create failed before the workspace was listed.
    markAsleepCloudPayloadApplied(dir, 'applied')

    prepareAsleepCloudWake(userData, id)
    expect(finishAsleepCloudWake(userData, id)).toBeNull()
    expect(existsSync(dir)).toBe(true)
    expect(readAsleepCloudWorkspaces(userData)).toHaveLength(1)
  })
})

describe('the sandbox apply script', () => {
  function stage(patch: string): string {
    const staged = join(root, 'stage')
    mkdirSync(join(staged, 'new-files'), { recursive: true })
    writeFileSync(join(staged, 'changes.patch'), patch)
    writeFileSync(join(staged, 'new-files', 'notes.md'), 'new file\n')
    return staged
  }
  const apply = (cwd: string, staged: string): string =>
    execFileSync('bash', ['-c', importChangesScript(staged)], { cwd, encoding: 'utf8' })

  it('applies the diff and adds the new files', () => {
    const staged = stage(run(mirror, 'diff', '--binary', 'HEAD'))
    run(clone, 'fetch', '-q', mirror, 'HEAD')
    run(clone, 'checkout', '-q', 'FETCH_HEAD')
    expect(parseImportChanges(apply(clone, staged))).toBe('applied')
    expect(readFileSync(join(clone, 'app.txt'), 'utf8')).toBe('one\nunpushed\nuncommitted\n')
    expect(readFileSync(join(clone, 'notes.md'), 'utf8')).toBe('new file\n')
  })

  it('keeps a diff that does not apply in .revio-import', () => {
    const staged = stage(run(mirror, 'diff', '--binary', 'HEAD'))
    expect(parseImportChanges(apply(clone, staged))).toBe('kept-aside')
    expect(readFileSync(join(clone, 'app.txt'), 'utf8')).toBe('one\n')
    expect(
      readFileSync(join(clone, '.revio-import', 'uncommitted-changes.patch'), 'utf8')
    ).toContain('+uncommitted')
    expect(existsSync(join(clone, '.revio-import', 'new-files', 'notes.md'))).toBe(true)
    expect(run(clone, 'status', '--porcelain')).toBe('')
  })
})
