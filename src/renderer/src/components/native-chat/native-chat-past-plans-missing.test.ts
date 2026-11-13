import { afterEach, describe, expect, it, vi } from 'vitest'
import { readWorkspacePlans } from './native-chat-past-plans'

afterEach(() => vi.unstubAllGlobals())

describe('readWorkspacePlans', () => {
  it('returns no plans without reading a missing plans folder', async () => {
    const readDir = vi.fn()
    vi.stubGlobal('window', { api: { fs: { pathExists: vi.fn(async () => false), readDir } } })
    expect(await readWorkspacePlans('/w')).toEqual([])
    expect(readDir).not.toHaveBeenCalled()
  })

  it('reads the folder when it exists', async () => {
    const readDir = vi.fn(async () => [])
    vi.stubGlobal('window', { api: { fs: { pathExists: vi.fn(async () => true), readDir } } })
    expect(await readWorkspacePlans('/w/')).toEqual([])
    expect(readDir).toHaveBeenCalledWith({ dirPath: '/w/.context/plans' })
  })
})
