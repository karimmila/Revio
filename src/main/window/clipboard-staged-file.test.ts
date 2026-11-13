import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLIPBOARD_STAGED_FILE_MAX_BYTES,
  createClipboardStagedFiles
} from './clipboard-staged-file'

let root: string

beforeEach(async () => {
  root = join(await mkdtemp(join(tmpdir(), 'orca-staged-')), 'staging')
})

afterEach(async () => {
  await rm(join(root, '..'), { recursive: true, force: true })
})

const b64 = (text: string): string => Buffer.from(text).toString('base64')

describe('createClipboardStagedFiles', () => {
  it('stages the chunks under the root with a safe name', async () => {
    const staged = createClipboardStagedFiles(root)
    const { transferId } = await staged.start('../evil/name.txt')
    await staged.append(transferId, b64('hello '))
    await staged.append(transferId, b64('world'))
    const path = await staged.finish(transferId)
    // Separators become underscores, so the name stays one segment inside the transfer folder.
    expect(path).toBe(join(root, transferId, '.._evil_name.txt'))
    expect(await readFile(path, 'utf8')).toBe('hello world')
  })

  it('refuses and removes a copy over the size cap', async () => {
    const staged = createClipboardStagedFiles(root)
    const { transferId } = await staged.start('big.bin')
    const chunk = Buffer.alloc(CLIPBOARD_STAGED_FILE_MAX_BYTES).toString('base64')
    await staged.append(transferId, chunk)
    await expect(staged.append(transferId, b64('x'))).rejects.toThrow(/50 MB/)
    await expect(staged.finish(transferId)).rejects.toThrow()
    expect(await readdir(join(root, transferId))).toEqual([])
  })

  it('clears earlier staged copies when a new copy starts', async () => {
    const staged = createClipboardStagedFiles(root)
    const first = await staged.start('a.txt')
    await staged.finish(first.transferId)
    const second = await staged.start('b.txt')
    expect(await readdir(root)).toEqual([second.transferId])
  })

  it('discards a cancelled copy', async () => {
    const staged = createClipboardStagedFiles(root)
    const { transferId } = await staged.start('c.txt')
    await staged.append(transferId, b64('data'))
    await staged.cancel(transferId)
    expect(await readdir(join(root, transferId))).toEqual([])
  })
})
