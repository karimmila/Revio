// @vitest-environment happy-dom
import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'
import {
  RevioTerminalLinkConfirmBridge,
  confirmTerminalLink,
  terminalLinkNeedsConfirm
} from './revio-terminal-link-confirm'

afterEach(() => {
  delete document.documentElement.dataset.revioLayout
})

it('asks "Open link?" with the URL in the workspace layout, and opens only on confirm', async () => {
  const dialog = vi.fn(async () => true)
  const view = render(
    <ConfirmationDialogContext.Provider value={dialog}>
      <RevioTerminalLinkConfirmBridge />
    </ConfirmationDialogContext.Provider>
  )
  expect(terminalLinkNeedsConfirm()).toBe(false)
  document.documentElement.dataset.revioLayout = 'true'
  expect(terminalLinkNeedsConfirm()).toBe(true)
  expect(await confirmTerminalLink('https://example.com/x')).toBe(true)
  expect(dialog).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Open link?',
      description: expect.stringContaining('https://example.com/x')
    })
  )
  dialog.mockResolvedValueOnce(false)
  expect(await confirmTerminalLink('https://example.com/y')).toBe(false)
  view.unmount()
  expect(terminalLinkNeedsConfirm()).toBe(false)
})
