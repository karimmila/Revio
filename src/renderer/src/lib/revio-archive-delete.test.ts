import { describe, expect, it, vi } from 'vitest'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'

const h = vi.hoisted((): { removed: string[]; fail: boolean } => ({ removed: [], fail: false }))

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { deleteArchivedWorkspace, onRevioArchiveChanged } = await import('./revio-archive')

const record: ArchivedWorkspace = {
  id: 'repo::/w/feat',
  repoId: 'repo',
  displayName: 'feat',
  branch: 'me/feat',
  archiveCommit: 'abc1234',
  archivedAt: 1,
  cloud: true,
  cloudRestore: { projectId: 'p', snapshotId: 'snap_abc12345' }
}

vi.stubGlobal('window', {
  api: {
    revioArchive: {
      delete: async (id: string) => {
        if (h.fail) {
          throw new Error('disk full')
        }
        h.removed.push(id)
      }
    }
  }
})

describe('deleteArchivedWorkspace', () => {
  it('deletes the record (main deletes its snapshot or checkpoint) and refreshes the list', async () => {
    const changed = vi.fn()
    const stop = onRevioArchiveChanged(changed)
    expect(await deleteArchivedWorkspace(record)).toBe(true)
    expect(h.removed).toEqual([record.id])
    expect(changed).toHaveBeenCalledOnce()
    stop()
  })

  it('reports a failed removal and keeps the list as it was', async () => {
    h.fail = true
    const changed = vi.fn()
    const stop = onRevioArchiveChanged(changed)
    expect(await deleteArchivedWorkspace(record)).toBe(false)
    expect(changed).not.toHaveBeenCalled()
    stop()
  })
})
