// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { restoreArchiveCheckpoint, saveArchiveCheckpoint } from './revio-archive-checkpoint'

vi.mock('sonner', () => ({ toast: { message: vi.fn() } }))

const save = vi.fn()
const restore = vi.fn()
beforeEach(() => {
  save.mockReset()
  restore.mockReset()
  Object.assign(window, { api: { turnCheckpoints: { save, restore } } })
})

it('keeps the work under an archive checkpoint session', async () => {
  save.mockResolvedValue('refs/revio-checkpoints/archive-5/5')
  expect(await saveArchiveCheckpoint('/w', 5)).toBe('archive-5')
  expect(save).toHaveBeenCalledWith({ worktreePath: '/w', sessionId: 'archive-5' })
  save.mockResolvedValue(null)
  expect(await saveArchiveCheckpoint('/w', 6)).toBeNull()
})

it('puts the work back only when the branch is where it was archived', async () => {
  restore.mockResolvedValue(true)
  const record = { archiveCommit: 'abc1234', checkpointSession: 'archive-5', displayName: 'w' }
  expect(await restoreArchiveCheckpoint({ path: '/n', head: 'abc1234ff' }, record)).toBe(true)
  expect(restore).toHaveBeenCalledWith({
    worktreePath: '/n',
    sessionId: 'archive-5',
    before: Number.MAX_SAFE_INTEGER
  })
  restore.mockClear()
  expect(await restoreArchiveCheckpoint({ path: '/n', head: 'def5678' }, record)).toBe(false)
  expect(restore).not.toHaveBeenCalled()
})
