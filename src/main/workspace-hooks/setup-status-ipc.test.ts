import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { readSetupStatus } from './setup-status-ipc'

let root: string | null = null
afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true })
  }
})

it("reads the status file the runner writes into the worktree's git dir", () => {
  root = mkdtempSync(join(tmpdir(), 'orca-setup-status-'))
  const worktree = join(root, 'wt')
  const gitdir = join(root, 'repo', '.git', 'worktrees', 'wt')
  mkdirSync(join(gitdir, 'orca'), { recursive: true })
  mkdirSync(worktree)
  writeFileSync(join(worktree, '.git'), `gitdir: ${gitdir}\n`)
  expect(readSetupStatus(worktree)).toBeNull()
  writeFileSync(join(gitdir, 'orca', 'setup-status'), 'running')
  expect(readSetupStatus(worktree)).toBe('running')
  writeFileSync(join(gitdir, 'orca', 'setup-status'), '2')
  expect(readSetupStatus(worktree)).toBe('failed')
})
