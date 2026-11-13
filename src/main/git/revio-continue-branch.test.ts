import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { gitContinueOnNewBranch } from './revio-continue-branch'

let root: string
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-continue-'))
  git(root, 'init', '--bare', '-b', 'main', 'origin.git')
  git(root, 'clone', 'origin.git', 'work')
  const work = join(root, 'work')
  git(work, 'config', 'user.email', 't@t')
  git(work, 'config', 'user.name', 't')
  git(work, 'checkout', '-b', 'main')
  writeFileSync(join(work, 'a.txt'), 'a')
  git(work, 'add', '.')
  git(work, 'commit', '-m', 'base')
  git(work, 'push', 'origin', 'main')
  git(work, 'checkout', '-b', 'feat')
  writeFileSync(join(work, 'b.txt'), 'b')
  git(work, 'add', '.')
  git(work, 'commit', '-m', 'feature')
  // The PR merged: main moved on the remote.
  git(work, 'push', 'origin', 'feat:main')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

it('switches the worktree to a new branch off the fetched target', async () => {
  const work = join(root, 'work')
  const result = await gitContinueOnNewBranch(work, 'origin/main')
  expect(result).toEqual({ branch: 'feat-2', base: 'origin/main' })
  expect(git(work, 'symbolic-ref', '--short', 'HEAD')).toBe('feat-2')
  expect(git(work, 'rev-parse', 'HEAD')).toBe(git(join(root, 'origin.git'), 'rev-parse', 'main'))
  // --no-track: the new branch must not push back to the merged target.
  expect(() => git(work, 'config', '--get', 'branch.feat-2.merge')).toThrow()
})
