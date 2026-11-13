import { describe, expect, it } from 'vitest'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'
import { planWorkspaceImport, summarizeImportSource } from './workspace-import-plan'
import { emptyWorkspaceImportLedger } from './workspace-import-ledger'

function workspace(
  sourceId: string,
  options: { archived?: boolean; chats?: string[]; at?: string; mirror?: boolean } = {}
): ImportSourceWorkspace {
  return {
    sourceId,
    repoName: 'web',
    repoRemoteUrl: null,
    repoRootPath: '/src/web',
    name: sourceId,
    path: `/ws/${sourceId}`,
    branch: `me/${sourceId}`,
    baseBranch: 'main',
    archived: options.archived ?? false,
    cloud: options.mirror ?? false,
    mirrorPath: options.mirror ? `/mirror/${sourceId}` : null,
    lastActivityAt: options.at ?? null,
    chats: (options.chats ?? []).map((id) => ({
      sourceId: id,
      agent: 'claude',
      providerSessionId: `p-${id}`,
      title: id,
      model: null,
      lastActivityAt: null
    }))
  }
}

const SOURCE = [
  workspace('a', { chats: ['a1', 'a2'], at: '2026-10-02', mirror: true }),
  workspace('b', { chats: ['b1'], at: '2026-10-05' }),
  workspace('c', { archived: true, chats: ['c1'], at: '2026-09-01' })
]

describe('workspace import plan', () => {
  it('counts active and archived work and leaves archived out by default', () => {
    const summary = summarizeImportSource(SOURCE, emptyWorkspaceImportLedger())
    expect(summary.active).toEqual({ workspaces: 2, chats: 3 })
    expect(summary.archived).toEqual({ workspaces: 1, chats: 1 })
    expect(summary.hasMirroredChanges).toBe(true)
    const plan = planWorkspaceImport(SOURCE, emptyWorkspaceImportLedger(), {
      includeArchived: false
    })
    expect(plan.map((planned) => planned.source.sourceId)).toEqual(['a', 'b'])
    const all = planWorkspaceImport(SOURCE, emptyWorkspaceImportLedger(), { includeArchived: true })
    expect(all.map((planned) => planned.source.sourceId)).toEqual(['c', 'a', 'b'])
  })

  it('only adds what an earlier run did not bring over', () => {
    const ledger = {
      workspaces: { a: 'repo::/wt/a', b: 'repo::/wt/b' },
      chats: { a1: 's', b1: 's' }
    }
    const plan = planWorkspaceImport(SOURCE, ledger, { includeArchived: false })
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ existingWorktreeId: 'repo::/wt/a' })
    expect(plan[0].chats.map((chat) => chat.sourceId)).toEqual(['a2'])
    const summary = summarizeImportSource(SOURCE, ledger)
    expect(summary.pending.active).toEqual({ workspaces: 0, chats: 1 })
  })

  it('treats a workspace imported asleep in the cloud as brought over', () => {
    const ledger = {
      workspaces: { a: 'asleep-cloud:imp-1', b: 'repo::/wt/b' },
      chats: { a1: 'p-a1', a2: 'p-a2', b1: 's' }
    }
    expect(planWorkspaceImport(SOURCE, ledger, { includeArchived: false })).toEqual([])
  })
})
