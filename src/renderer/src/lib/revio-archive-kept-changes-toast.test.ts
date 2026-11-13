import { beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({
  success: vi.fn((_title: string, _options: { description: string }) => 'toast-7'),
  error: vi.fn(),
  dismiss: vi.fn()
}))
vi.mock('sonner', () => ({ toast }))

import {
  dismissArchiveToast,
  showArchiveKeptChangesToast
} from './revio-archive-kept-changes-toast'

const unarchive = vi.fn(async () => true)

beforeEach(() => {
  toast.success.mockClear()
  toast.dismiss.mockClear()
})

describe('archive toast', () => {
  it('speaks of uncommitted changes only when the workspace had some', () => {
    showArchiveKeptChangesToast('w1', 'Feature', unarchive, { hadUncommittedChanges: true })
    showArchiveKeptChangesToast('w2', 'Tidy', unarchive, { hadUncommittedChanges: false })
    const descriptions = toast.success.mock.calls.map(([, options]) => options.description)
    expect(descriptions[0]).toContain('uncommitted changes are kept')
    expect(descriptions[1]).toBe('Unarchive it from Home to get it back.')
  })

  it('goes away once its workspace is deleted for good, and only then', () => {
    showArchiveKeptChangesToast('w1', 'Feature', unarchive, { hadUncommittedChanges: true })
    // Showing it again replaced the toast the test above left for the same workspace.
    toast.dismiss.mockClear()
    dismissArchiveToast('other')
    expect(toast.dismiss).not.toHaveBeenCalled()
    dismissArchiveToast('w1')
    expect(toast.dismiss).toHaveBeenCalledWith('toast-7')
    // Already gone: a second delete has nothing to dismiss.
    dismissArchiveToast('w1')
    expect(toast.dismiss).toHaveBeenCalledOnce()
  })
})
