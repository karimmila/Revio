// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const open = vi.hoisted(() => vi.fn())
vi.mock('./use-native-chat-file-link-click', () => ({ useNativeChatFileLinkClick: () => open }))

const { NativeChatMarkdownPdf, isNativeChatPdfSource } = await import('./NativeChatMarkdownPdf')

afterEach(cleanup)

it('knows a PDF source by its extension', () => {
  expect(isNativeChatPdfSource('docs/spec.pdf')).toBe(true)
  expect(isNativeChatPdfSource('shot.png')).toBe(false)
})

it('a PDF opens through the file link, so it lands in Orca’s PDF viewer', () => {
  render(<NativeChatMarkdownPdf src="docs/spec.pdf" />)
  fireEvent.click(screen.getByRole('button', { name: /spec\.pdf/ }))
  expect(open).toHaveBeenCalledWith(
    expect.anything(),
    expect.stringContaining(encodeURIComponent('docs/spec.pdf'))
  )
})
