// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { RevioCloudInventory } from './RevioCloudInventory'

const deleteSandbox = vi.fn(async () => undefined)
const asked: ConfirmationDialogOptions[] = []
let answer = false

beforeEach(() => {
  vi.clearAllMocks()
  asked.length = 0
  Object.assign(window, {
    api: {
      cloud: {
        inventory: async () => ({
          sandboxes: [
            {
              name: 'revio-other-mac',
              status: 'stopped',
              kind: 'workspace',
              owner: null,
              orphan: true,
              createdAt: 1
            }
          ],
          snapshots: []
        }),
        deleteSandbox
      }
    }
  })
})
afterEach(cleanup)

const answerConfirm = async (options: ConfirmationDialogOptions): Promise<boolean> => {
  asked.push(options)
  return answer
}

async function pressDelete(): Promise<void> {
  const view = render(
    <ConfirmationDialogContext.Provider value={answerConfirm}>
      <RevioCloudInventory />
    </ConfirmationDialogContext.Provider>
  )
  const button = await waitFor(() => {
    const found = view.container.querySelector('[data-revio-icon-button]')
    if (!found) {
      throw new Error('no delete button yet')
    }
    return found
  })
  fireEvent.click(button)
  await waitFor(() => expect(asked).toHaveLength(1))
}

it('asks before it deletes a sandbox this Mac did not create, and keeps it on Cancel', async () => {
  answer = false
  await pressDelete()
  expect(asked[0].title).toContain('revio-other-mac')
  expect(asked[0].description).toMatch(/not created by this Mac.*another Mac/)
  expect(asked[0].confirmVariant).toBe('destructive')
  expect(deleteSandbox).not.toHaveBeenCalled()
})

it('deletes the sandbox once the person confirms', async () => {
  answer = true
  await pressDelete()
  await waitFor(() => expect(deleteSandbox).toHaveBeenCalledWith('revio-other-mac'))
})
