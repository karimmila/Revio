// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { RevioLinkWorkMenuItems } from './RevioLinkWorkMenuItems'

type LinkTarget = React.ComponentProps<typeof RevioLinkWorkMenuItems>['worktree']

const worktree: LinkTarget = {
  id: 'r::/w',
  repoId: 'r',
  hostId: 'local',
  displayName: 'bristleworm',
  linkedIssue: null,
  linkedPR: null,
  comment: ''
}

function renderItems(target: LinkTarget): void {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <RevioLinkWorkMenuItems worktree={target} disabled={false} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

afterEach(cleanup)

it('offers one link item, which opens Workspace details on its linked-work field', () => {
  const openModal = vi.fn()
  useAppStore.setState({ openModal })
  renderItems(worktree)
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Link issue or PR…'
  ])
  fireEvent.click(screen.getByRole('menuitem', { name: 'Link issue or PR…' }))
  expect(openModal).toHaveBeenCalledWith(
    'edit-meta',
    expect.objectContaining({ worktreeId: 'r::/w', currentPR: null, focus: 'issue' })
  )
})

it('adds Unlink once a pull request is linked', () => {
  renderItems({ ...worktree, linkedPR: 9 })
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Link issue or PR…',
    'Unlink PR #9'
  ])
})
