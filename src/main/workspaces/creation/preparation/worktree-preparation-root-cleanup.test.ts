import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKTREE_CREATE_PREPARATION_DIRECTORY } from '../../../../shared/worktree/create-preparation'
import { removeEmptyPreparationRoot } from './worktree-preparation-root-cleanup'

let workspaces: string
let root: string

beforeEach(() => {
  workspaces = mkdtempSync(join(tmpdir(), 'preparation-root-'))
  root = join(workspaces, WORKTREE_CREATE_PREPARATION_DIRECTORY)
  mkdirSync(root)
})
afterEach(() => {
  rmSync(workspaces, { recursive: true, force: true })
})

describe('removeEmptyPreparationRoot', () => {
  it('removes the folder once its last prepared checkout is gone', async () => {
    await removeEmptyPreparationRoot(join(root, '123-prepared'))
    expect(existsSync(root)).toBe(false)
    expect(existsSync(workspaces)).toBe(true)
  })

  it('keeps a folder that still holds another prepared checkout', async () => {
    mkdirSync(join(root, '456-other'))
    await removeEmptyPreparationRoot(join(root, '123-prepared'))
    expect(existsSync(join(root, '456-other'))).toBe(true)
  })

  it('never removes a folder that is not the preparation folder', async () => {
    const remove = vi.fn(async () => undefined)
    const elsewhere = join(workspaces, 'my-workspace')
    await removeEmptyPreparationRoot(join(elsewhere, 'src'), remove)
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not fail when the folder is already gone', async () => {
    rmSync(root, { recursive: true })
    await expect(removeEmptyPreparationRoot(join(root, '123-prepared'))).resolves.toBeUndefined()
  })
})
