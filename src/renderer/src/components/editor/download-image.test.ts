// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({
  loading: vi.fn(() => 't1'),
  success: vi.fn(),
  dismiss: vi.fn()
}))
vi.mock('sonner', () => ({ toast }))

import { downloadImage, downloadName, readWithProgress } from './download-image'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('names the download after the file, without its folders', () => {
  expect(downloadName('assets/logo.png')).toBe('logo.png')
  expect(downloadName('C:\\shots\\a.png')).toBe('a.png')
  expect(downloadName('')).toBe('image')
})

it('reports progress while reading a body of known size', async () => {
  const progress: number[] = []
  const body = new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-length': '4' } })
  const bytes = await readWithProgress(body, (fraction) => progress.push(fraction))
  expect([...bytes]).toEqual([1, 2, 3, 4])
  expect(progress.at(-1)).toBe(1)
})

it('saves into Downloads through Orca and says Image saved', async () => {
  const saveDownload = vi.fn(async () => '/Users/me/Downloads/shot.png')
  vi.stubGlobal('window', Object.assign(window, { api: { shell: { saveDownload } } }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([9])))
  )
  await downloadImage('blob:x', 'dir/shot.png')
  expect(saveDownload).toHaveBeenCalledWith('shot.png', expect.any(Uint8Array))
  expect(toast.success).toHaveBeenCalledWith('Image saved', { id: 't1' })
})

it('falls back to a browser download when the source cannot be read', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('window', Object.assign(window, { api: { shell: { saveDownload: vi.fn() } } }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  )
  await downloadImage('blob:x', 'shot.png')
  expect(click).toHaveBeenCalled()
})
