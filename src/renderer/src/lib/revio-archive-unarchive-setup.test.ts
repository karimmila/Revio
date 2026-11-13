import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'

type Approval =
  | { setupDecision: 'inherit' | 'skip'; trustDecision: 'run' | 'skip'; approvedSetupHash?: string }
  | 'cancelled'

const h = vi.hoisted(() => ({
  createWorktree: vi.fn(),
  confirm: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ repos: [], createWorktree: h.createWorktree }) }
}))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./workspace-setup-trust', () => ({ confirmWorkspaceSetupDecision: h.confirm }))

const { unarchiveRevioWorkspace } = await import('./revio-archive')

const record: ArchivedWorkspace = {
  id: 'repo::/w/feat',
  repoId: 'repo',
  displayName: 'feat',
  branch: 'me/feat',
  archiveCommit: 'abc1234',
  archivedAt: 1,
  cloud: false
}

vi.stubGlobal('window', { api: { revioArchive: { remove: async () => undefined } } })

async function unarchiveWith(approval: Approval | Error): Promise<unknown[]> {
  if (approval instanceof Error) {
    h.confirm.mockRejectedValue(approval)
  } else {
    h.confirm.mockResolvedValue(approval)
  }
  expect(await unarchiveRevioWorkspace(record)).toBe(true)
  return h.createWorktree.mock.calls[0] ?? []
}

describe('unarchive and the setup script', () => {
  beforeEach(() => {
    h.confirm.mockReset()
    h.createWorktree.mockReset()
    h.createWorktree.mockResolvedValue({ worktree: { id: 'w', path: '/w/feat', head: 'abc1234' } })
  })

  it('asks for the same approval as a new workspace and sends the approved hash to the host', async () => {
    const args = await unarchiveWith({
      setupDecision: 'inherit',
      trustDecision: 'run',
      approvedSetupHash: 'hash-of-approved-script'
    })
    expect(h.confirm).toHaveBeenCalledWith(
      expect.any(Function),
      'repo',
      'inherit',
      undefined,
      expect.any(Function)
    )
    expect(args[3]).toBe('inherit')
    expect(args.at(-1)).toEqual({
      branchIntent: 'open-existing-v2',
      approvedSetupHash: 'hash-of-approved-script'
    })
  })

  it('skips setup when the person skips the prompt', async () => {
    const args = await unarchiveWith({ setupDecision: 'skip', trustDecision: 'skip' })
    expect(args[3]).toBe('skip')
    expect(args.at(-1)).toEqual({ branchIntent: 'open-existing-v2' })
  })

  it('skips setup when the prompt is cancelled or cannot be shown', async () => {
    expect((await unarchiveWith('cancelled'))[3]).toBe('skip')
    h.createWorktree.mockClear()
    expect((await unarchiveWith(new Error('The project host is unknown.')))[3]).toBe('skip')
  })
})
