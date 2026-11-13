import type { Worktree, WorkspaceStatusDefinition } from '../../../../shared/worktree/types'
import { getWorkspaceStatus } from '../../../../shared/workspace-statuses'

export type HomeGroupBy = 'none' | 'status' | 'project'

type HomeRow = Pick<Worktree, 'repoId' | 'workspaceStatus'>

export type HomeGroup<T extends HomeRow> = { key: string; label: string | null; rows: T[] }

/**
 * The Home "Group by": one unlabeled group, or a group per status (in the status list's
 * order) or per project (by name). Empty groups are left out; rows keep their sort order.
 */
export function groupHomeRows<T extends HomeRow>(
  rows: readonly T[],
  groupBy: HomeGroupBy,
  statuses: readonly WorkspaceStatusDefinition[],
  repoNames: ReadonlyMap<string, string>
): HomeGroup<T>[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: null, rows: [...rows] }]
  }
  const buckets = new Map<string, T[]>()
  for (const row of rows) {
    const key = groupBy === 'status' ? getWorkspaceStatus(row, statuses) : row.repoId
    buckets.set(key, [...(buckets.get(key) ?? []), row])
  }
  if (groupBy === 'status') {
    return statuses
      .filter((status) => buckets.has(status.id))
      .map((status) => ({ key: status.id, label: status.label, rows: buckets.get(status.id)! }))
  }
  return [...buckets.entries()]
    .map(([repoId, groupRows]) => ({
      key: repoId,
      label: repoNames.get(repoId) ?? repoId,
      rows: groupRows
    }))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
}
