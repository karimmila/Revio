// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const deletes: unknown[][] = []
  return { deletes, openModal: vi.fn() }
})

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (select: (state: Record<string, unknown>) => unknown) =>
      select({ settings: {}, openModal: h.openModal }),
    { getState: () => ({ openModal: h.openModal }) }
  )
}))
vi.mock('@/components/sidebar/workspace-actions/deletion/delete-worktree-flow', () => ({
  runWorktreeDelete: (...args: unknown[]) => h.deletes.push(args)
}))
vi.mock('@/lib/cloud-workspaces', () => ({
  isCloudMirrorPath: () => false,
  isCloudRepo: () => true,
  useCloudEnvironmentIds: () => new Set(['env-cloud'])
}))
vi.mock('@/components/sidebar/workspace-card/identity/WorktreeTitleInlineRename', () => ({
  WorktreeTitleInlineRename: ({ displayName }: { displayName: string }) => (
    <span>{displayName}</span>
  )
}))
vi.mock('./RevioWorkspaceHoverCard', () => ({
  RevioWorkspaceHoverCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  formatRevioAgo: () => '1h'
}))
vi.mock('./RevioStatusGlyph', () => ({ RevioStatusGlyph: () => null }))
vi.mock('./revio-layout', () => ({ RevioLineTotal: () => null }))
vi.mock('./RevioOpenDraftButton', () => ({ RevioOpenDraftButton: () => null }))
vi.mock('@/components/sidebar/workspace-card/activity/use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => null
}))
vi.mock('./use-revio-chat-phase', () => ({ useRevioChatPhase: () => null }))
vi.mock('./revio-setup-status', () => ({ useSetupStatus: () => null }))
vi.mock('./revio-stale-failure', () => ({ useRevioRowStatus: (status: unknown) => status }))
vi.mock('./revio-row-pr-state', () => ({
  revioRowAgentIcon: () => null,
  revioRowPrState: () => null
}))

import { RevioWorkspaceRow } from './RevioWorkspaceRow'

afterEach(cleanup)

it('archives a cloud workspace through the restore-point archive, never a project removal', () => {
  const card = {
    worktree: {
      id: 'vm-repo::/vercel/example-repo',
      hostId: 'runtime:env-cloud',
      path: '/vercel/example-repo',
      isMainWorktree: true,
      createdAt: 1_794_000_000_000
    },
    repo: { id: 'vm-repo', displayName: 'example-repo' },
    affiliateListMode: false,
    isDeleting: false,
    visibleCardTitle: 'hey-just-create-env'
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the row reads only these card fields; the rest of the controller is mocked out above.
  render(<RevioWorkspaceRow card={card as never} />)
  fireEvent.click(screen.getByLabelText('Archive workspace'))
  expect(h.deletes).toEqual([
    ['vm-repo::/vercel/example-repo', { expectedHostId: 'runtime:env-cloud' }]
  ])
  expect(h.openModal).not.toHaveBeenCalled()
})
