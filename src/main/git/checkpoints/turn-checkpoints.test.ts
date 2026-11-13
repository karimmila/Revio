import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  deleteArchiveCheckpoint,
  restoreTurnCheckpoint,
  saveTurnCheckpoint
} from './turn-checkpoints'
import { FORK_CLI_COMMAND_NAME } from '../../../shared/fork-identity'

const ROOT = `refs/${FORK_CLI_COMMAND_NAME}-checkpoints`

let repo: string
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'orca-checkpoint-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
  writeFileSync(join(repo, 'a.txt'), 'one\n')
  writeFileSync(join(repo, '.gitignore'), 'ignored.txt\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
})
afterEach(() => rmSync(repo, { recursive: true, force: true }))

it('saves without touching files, then restores files, untracked files, index and HEAD', async () => {
  writeFileSync(join(repo, 'a.txt'), 'two\n')
  writeFileSync(join(repo, 'new.txt'), 'new\n')
  git('add', 'new.txt')
  const before = git('status', '--porcelain')
  const ref = await saveTurnCheckpoint(repo, 'session-1', {}, 1000)
  expect(ref).toBe(`${ROOT}/session-1/1000`)
  expect(git('status', '--porcelain')).toBe(before)

  // The turn: edits, a new untracked file, a commit.
  writeFileSync(join(repo, 'a.txt'), 'three\n')
  writeFileSync(join(repo, 'later.txt'), 'later\n')
  writeFileSync(join(repo, 'ignored.txt'), 'keep me\n')
  git('commit', '-q', '-am', 'turn')

  expect(await restoreTurnCheckpoint(repo, 'session-1', 1500)).toBe(true)
  expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('two\n')
  expect(existsSync(join(repo, 'later.txt'))).toBe(false)
  expect(readFileSync(join(repo, 'new.txt'), 'utf8')).toBe('new\n')
  expect(readFileSync(join(repo, 'ignored.txt'), 'utf8')).toBe('keep me\n')
  expect(git('log', '-1', '--format=%s')).toBe('init')
  expect(git('status', '--porcelain')).toBe(before)
})

it('picks the newest checkpoint at or before the message, and none before the first', async () => {
  await saveTurnCheckpoint(repo, 's', {}, 1000)
  writeFileSync(join(repo, 'a.txt'), 'second\n')
  await saveTurnCheckpoint(repo, 's', {}, 2000)
  writeFileSync(join(repo, 'a.txt'), 'third\n')
  expect(await restoreTurnCheckpoint(repo, 's', 500)).toBe(false)
  expect(await restoreTurnCheckpoint(repo, 's', 2500)).toBe(true)
  expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('second\n')
  expect(await restoreTurnCheckpoint(repo, 's', 1500)).toBe(true)
  expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('one\n')
})

it('deletes only the archive checkpoint it names, and refuses a chat session', async () => {
  writeFileSync(join(repo, 'a.txt'), 'uncommitted\n')
  await saveTurnCheckpoint(repo, 'archive-1700', {}, 1000)
  await saveTurnCheckpoint(repo, 'archive-17001', {}, 1000)
  await saveTurnCheckpoint(repo, 'session-1', {}, 1000)
  expect(await deleteArchiveCheckpoint(repo, 'archive-1700')).toBe(true)
  expect(git('for-each-ref', '--format=%(refname)', `${ROOT}/`).split('\n')).toEqual([
    `${ROOT}/archive-17001/1000`,
    `${ROOT}/session-1/1000`
  ])
  expect(await deleteArchiveCheckpoint(repo, 'archive-1700')).toBe(false)
  await expect(deleteArchiveCheckpoint(repo, 'session-1')).rejects.toThrow(/archive/)
})

it('still restores and deletes a checkpoint an older build saved under the upstream ref', async () => {
  writeFileSync(join(repo, 'a.txt'), 'old build\n')
  const saved = await saveTurnCheckpoint(repo, 'archive-42', {}, 1000)
  // Move it to where an older build wrote it.
  const legacy = 'refs/orca-checkpoints/archive-42/1000'
  git('update-ref', legacy, git('rev-parse', saved ?? ''))
  git('update-ref', '-d', saved ?? '')
  writeFileSync(join(repo, 'a.txt'), 'later\n')

  expect(await restoreTurnCheckpoint(repo, 'archive-42', 2000)).toBe(true)
  expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('old build\n')
  expect(await deleteArchiveCheckpoint(repo, 'archive-42')).toBe(true)
  expect(git('for-each-ref', '--format=%(refname)', 'refs/orca-checkpoints/')).toBe('')
})
