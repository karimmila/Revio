// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { RevioReviewButton } from './RevioReviewButton'

const launch = vi.hoisted(() => vi.fn(() => true))
vi.mock('./launch-revio-chat', () => ({ requestRevioReview: launch }))
vi.mock('./revio-layout', () => ({ useRevioLayout: () => true }))

afterEach(cleanup)

it('Review sends at once; Edit before sending leaves the prompt as a draft', async () => {
  useAppStore.setState({ activeWorktreeId: 'r::/w' })
  render(<RevioReviewButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  expect(launch).toHaveBeenLastCalledWith('r::/w', false)
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Review' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit before sending' }))
  expect(launch).toHaveBeenLastCalledWith('r::/w', true)
})
