import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FsPromises from 'node:fs/promises'

const refused = vi.hoisted(() => new Set<string>())
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  const readdir = async (path: string): Promise<string[]> => {
    if (refused.has(path)) {
      throw Object.assign(new Error(`EPERM: operation not permitted, scandir '${path}'`), {
        code: 'EPERM'
      })
    }
    return actual.readdir(path)
  }
  return { ...actual, default: { ...actual, readdir }, readdir }
})

import {
  firstDeniedFolder,
  isFolderAccessDenied,
  probeFolderAccess
} from './workspace-import-folder-access'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-access-'))
  refused.clear()
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('folder access for the workspace import', () => {
  it('tells a folder macOS refuses from one that is missing or readable', async () => {
    refused.add('/Users/someone/Desktop/web')
    expect(await probeFolderAccess('/Users/someone/Desktop/web')).toBe('denied')
    expect(await probeFolderAccess(join(root, 'gone'))).toBe('missing')
    expect(await probeFolderAccess(root)).toBe('ok')
  })

  it('names the first refused folder and passes over missing ones', async () => {
    refused.add('/Volumes/disk/web')
    expect(await firstDeniedFolder([null, join(root, 'gone'), root, '/Volumes/disk/web'])).toBe(
      '/Volumes/disk/web'
    )
    expect(await firstDeniedFolder([null, root])).toBeNull()
  })

  it('reads the refusal git prints as text', () => {
    expect(
      isFolderAccessDenied(
        Object.assign(new Error('Command failed'), {
          stderr: "fatal: cannot change to '/Users/someone/Desktop/web': Operation not permitted"
        })
      )
    ).toBe(true)
    expect(isFolderAccessDenied(new Error('fatal: not a git repository'))).toBe(false)
    expect(isFolderAccessDenied(null)).toBe(false)
  })
})
