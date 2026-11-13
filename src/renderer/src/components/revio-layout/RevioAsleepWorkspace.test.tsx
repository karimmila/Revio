// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import RevioAsleepWorkspace from './RevioAsleepWorkspace'
import { RevioCloudRowMark } from './RevioCloudRowMark'
import { setAsleepCloudEnvironmentsForTest } from '@/lib/cloud-asleep-environments'

const h = vi.hoisted(() => ({ activate: vi.fn(async () => {}) }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: Record<string, unknown>) => unknown) =>
    select({
      worktreesByRepo: {
        'vm-repo': [{ id: 'vm-repo::/vercel/app', repoId: 'vm-repo', displayName: 'Fix login' }]
      }
    })
}))
vi.mock('@/lib/sidebar-worktree-activation', () => ({ activateWorktreeFromSidebar: h.activate }))

afterEach(() => {
  cleanup()
  setAsleepCloudEnvironmentsForTest([])
})

it('names the asleep workspace and wakes it by opening it', () => {
  render(<RevioAsleepWorkspace worktreeId="vm-repo::/vercel/app" />)
  expect(screen.getByText('Fix login')).toBeTruthy()
  expect(screen.getByText('This workspace is asleep')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Wake' }))
  expect(h.activate).toHaveBeenCalledWith('vm-repo::/vercel/app')
})

it('marks an asleep cloud row with a moon and a dimmed cloud, but not the open workspace', () => {
  const repo = { executionHostId: 'runtime:env-1' } as const
  const view = render(<RevioCloudRowMark repo={repo} active={false} />)
  expect(screen.queryByLabelText('Asleep')).toBeNull()
  expect(screen.getByLabelText('Cloud workspace').getAttribute('class')).not.toContain('opacity-40')

  setAsleepCloudEnvironmentsForTest(['env-1'])
  view.rerender(<RevioCloudRowMark repo={repo} active={false} />)
  expect(screen.getByLabelText('Asleep')).toBeTruthy()
  expect(view.container.querySelector('[data-revio-row-asleep]')?.getAttribute('title')).toBe(
    'Asleep. Open to wake it.'
  )
  expect(screen.getByLabelText('Cloud workspace').getAttribute('class')).toContain('opacity-40')

  view.rerender(<RevioCloudRowMark repo={repo} active />)
  expect(screen.queryByLabelText('Asleep')).toBeNull()
  view.rerender(
    <RevioCloudRowMark repo={{ executionHostId: 'runtime:env-2' as const }} active={false} />
  )
  expect(screen.queryByLabelText('Asleep')).toBeNull()
})
