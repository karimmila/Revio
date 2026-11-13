import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, ipcMain: { handle: vi.fn() } }))

import { safeDownloadName, uniqueDownloadPath } from './save-download'

describe('save download', () => {
  it('keeps only a plain file name', () => {
    expect(safeDownloadName('../../etc/passwd')).toBe('passwd')
    expect(safeDownloadName('a\\b\\shot.png')).toBe('shot.png')
    expect(safeDownloadName('bad:name?.png')).toBe('bad_name_.png')
    expect(safeDownloadName('..')).toBe('download')
  })

  it('never overwrites an existing file', () => {
    const taken = new Set(['/d/shot.png', '/d/shot (2).png'])
    expect(uniqueDownloadPath('/d', 'shot.png', (p) => taken.has(p))).toBe('/d/shot (3).png')
    expect(uniqueDownloadPath('/d', 'new.png', (p) => taken.has(p))).toBe('/d/new.png')
  })
})
