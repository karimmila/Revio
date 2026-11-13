import type { WorktreeOccurrencePlan } from '../worktree-occurrence-plan'
import type { Worktree } from '../worktree/types'
import type { ExecutionHostId } from '../execution-host'
import { ALL_GROUP_KEY } from './group-keys'
import { getLaneHostWorktreeCounts, getLaneHostWorktreeIds } from './host-labels'
import { appendWorktreeRows } from './row-builders'
import type { RenderableFolderWorkspace } from './folder-workspace-lanes'
import type { RepoOfWorktree, Row } from './row-types'

/** The ungrouped list (groupBy none): one "all" header, then every row. */
export function emitFlatGroup(
  result: Row[],
  context: {
    naturalWorktrees: readonly Worktree[]
    folderWorkspaces: readonly RenderableFolderWorkspace[]
    repoOf: RepoOfWorktree
    defaultHostId: ExecutionHostId
    collapsedGroups: Set<string>
    occurrencePlan: WorktreeOccurrencePlan<Worktree>
    hostContextLabels: ReadonlyMap<string, string> | undefined
    folderPairByIdentity: ReadonlyMap<string, RenderableFolderWorkspace>
  }
): void {
  const { naturalWorktrees, folderWorkspaces, repoOf, defaultHostId, collapsedGroups } = context
  // Folder-only accounts must still render flat rows (#15362).
  if (naturalWorktrees.length === 0 && folderWorkspaces.length === 0) {
    return
  }
  result.push({
    type: 'header',
    key: ALL_GROUP_KEY,
    count: naturalWorktrees.length + folderWorkspaces.length,
    icon: { kind: 'all' },
    hostWorktreeCounts: getLaneHostWorktreeCounts(
      naturalWorktrees,
      folderWorkspaces,
      repoOf,
      defaultHostId
    ),
    hostWorktreeIds: getLaneHostWorktreeIds(
      naturalWorktrees,
      folderWorkspaces,
      repoOf,
      defaultHostId
    ),
    worktreeIds: naturalWorktrees.map((worktree) => worktree.id)
  })
  if (!collapsedGroups.has(ALL_GROUP_KEY)) {
    appendWorktreeRows(result, repoOf, context.occurrencePlan, {
      collapsedGroups,
      groupDepth: 0,
      sectionKey: ALL_GROUP_KEY,
      hostContextLabelByWorktreeIdentity: context.hostContextLabels,
      folderPairByIdentity: context.folderPairByIdentity
    })
  }
}
