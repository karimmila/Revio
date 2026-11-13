// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { copiedFilePathsText, pasteCopiedFilePaths } from './revio-paste-file-paths'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('joins paths on one line and quotes those with spaces', () => {
  expect(copiedFilePathsText(['/a/b.ts', '/Users/me/My File.png'])).toBe(
    '/a/b.ts "/Users/me/My File.png"'
  )
})

it('types the copied files into the input, and nothing when no file was copied', async () => {
  const input = document.createElement('div')
  input.setAttribute('contenteditable', 'true')
  document.body.append(input)
  const exec = vi.fn(() => true)
  document.execCommand = exec
  const read = vi.fn(async () => ['/x/y.md'])
  vi.stubGlobal('api', { ui: { readClipboardFilePaths: read } })
  expect(await pasteCopiedFilePaths(input)).toBe(true)
  expect(exec).toHaveBeenCalledWith('insertText', false, '/x/y.md')
  read.mockResolvedValueOnce([])
  expect(await pasteCopiedFilePaths(input)).toBe(false)
  expect(exec).toHaveBeenCalledOnce()
})
