import { describe, expect, it } from 'vitest'
import type { Repo } from '../repo-types'
import type { Worktree } from '../worktree/types'
import { cloneDefaultWorkspaceStatuses } from '../workspace-statuses'
import { planSidebarRows } from './sidebar-row-plan'
import { customSectionKey, type SidebarCustomSection } from './custom-section-rows'
import type { Row } from './row-types'

const repo: Repo = {
  id: 'repo-1',
  path: '/work/api',
  displayName: 'api',
  badgeColor: '#000000',
  addedAt: 0
}
const row = (id: string, isPinned = false): Worktree => ({
  id,
  instanceId: `${id}#instance`,
  repoId: repo.id,
  path: `/work/${id}`,
  branch: `refs/heads/${id}`,
  head: 'abc',
  isBare: false,
  isMainWorktree: false,
  linkedIssue: null,
  linkedPR: null,
  linkedLinearIssue: null,
  isArchived: false,
  comment: '',
  isUnread: false,
  isPinned,
  displayName: id,
  sortOrder: 0,
  lastActivityAt: 0
})

function plan(worktrees: Worktree[], customSections: SidebarCustomSection[]): string[] {
  const rows: Row[] = planSidebarRows({
    groupBy: 'none',
    sortBy: 'name',
    worktrees,
    repoMap: new Map([[repo.id, repo]]),
    prGroupOf: () => 'in-progress',
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    projectOrderBy: 'manual',
    lineageById: {},
    lineageParentIdentities: new Map(),
    worktreeMap: new Map(worktrees.map((entry) => [entry.id, entry])),
    nestLineage: false,
    projectGroups: [],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [],
    defaultHostId: 'local',
    pinnedDisplayPolicy: 'single-location',
    filterRepoIds: [],
    customSections
  }).render(new Set())
  return rows.flatMap((entry) =>
    entry.type === 'header'
      ? [`header ${entry.label ?? entry.key} ${entry.count}`]
      : entry.type === 'item'
        ? [entry.worktree.id]
        : []
  )
}

describe('custom sidebar sections', () => {
  const ideas = {
    key: customSectionKey('ideas'),
    label: 'Ideas',
    worktreeIds: new Set(['b'])
  }

  it('moves a workspace out of the list into its section, after the workspaces', () => {
    expect(plan([row('a'), row('b'), row('c')], [ideas])).toEqual([
      'header all 2',
      'a',
      'c',
      'header Ideas 1',
      'b'
    ])
  })

  it('keeps an empty section so workspaces can move in', () => {
    const empty = { ...ideas, worktreeIds: new Set<string>() }
    expect(plan([row('a')], [empty])).toEqual(['header all 1', 'a', 'header Ideas 0'])
  })

  it('leaves pinned workspaces in Pinned', () => {
    const pinnedIdeas = { ...ideas, worktreeIds: new Set(['p']) }
    expect(plan([row('p', true), row('a')], [pinnedIdeas])).toEqual([
      'header pinned 1',
      'p',
      'header all 1',
      'a',
      'header Ideas 0'
    ])
  })
})
