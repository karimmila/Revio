// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CloudInventory } from '../../../../../shared/cloud/cloud-types'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'
import { RevioCloudInventory } from './RevioCloudInventory'

// The inventory asks before it deletes a sandbox another Mac made; these cases never delete.
const neverAsked = async (): Promise<boolean> => false

function renderInventory() {
  return render(
    <ConfirmationDialogContext.Provider value={neverAsked}>
      <RevioCloudInventory />
    </ConfirmationDialogContext.Provider>
  )
}

function renderWith(inventory: CloudInventory) {
  vi.stubGlobal('api', { cloud: { inventory: vi.fn(async () => inventory) } })
  return renderInventory()
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('says there are no unused snapshots instead of leaving the row blank', async () => {
  const view = renderWith({
    sandboxes: [],
    snapshots: [
      {
        id: 'snap_used',
        sizeBytes: 2e9,
        createdAt: 1_794_000_000_000,
        automatic: true,
        referenced: true
      }
    ]
  })
  await waitFor(() => expect(view.container.textContent).toContain('No unused snapshots.'))
  expect(view.container.textContent).not.toContain('snap_used')
})

it('lists unused snapshots and drops the empty line', async () => {
  const view = renderWith({
    sandboxes: [],
    snapshots: [
      {
        id: 'snap_old',
        sizeBytes: 3e8,
        createdAt: 1_794_000_000_000,
        automatic: true,
        referenced: false
      }
    ]
  })
  await waitFor(() => expect(view.container.textContent).toContain('snap_old'))
  expect(view.container.textContent).not.toContain('No unused snapshots.')
})

it('shows no empty line before the inventory has loaded', () => {
  vi.stubGlobal('api', { cloud: { inventory: vi.fn(() => new Promise<CloudInventory>(() => {})) } })
  const view = renderInventory()
  expect(view.container.textContent).not.toContain('No unused snapshots.')
})
