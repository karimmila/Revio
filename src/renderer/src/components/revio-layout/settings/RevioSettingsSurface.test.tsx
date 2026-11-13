// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ activeModal: 'none' }))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof store) => unknown) => selector(store)
}))
vi.mock('@/components/sidebar/RemoveFolderDialog', () => ({
  default: () => <div role="dialog">Remove Project</div>
}))
vi.mock('./RevioSettings', () => ({ default: () => <div>settings pages</div> }))

import { RevioSettingsDialogs } from './RevioSettingsSurface'

afterEach(cleanup)

it('shows the Remove Project confirm above settings, with no sidebar on screen', async () => {
  store.activeModal = 'confirm-remove-folder'
  render(<RevioSettingsDialogs />)
  expect(await screen.findByRole('dialog')).toHaveProperty('textContent', 'Remove Project')
})

it('mounts no dialog while no removal is being confirmed', () => {
  store.activeModal = 'none'
  render(<RevioSettingsDialogs />)
  expect(screen.queryByRole('dialog')).toBeNull()
})
