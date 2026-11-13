import { isCloudRepo } from '@/lib/cloud-workspaces'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

export type RevioLocation = 'local' | 'cloud'

/** Whether a workspace belongs on a location's screen; unknown while repos or cloud ids load. */
export type LocationMembership = 'yes' | 'no' | 'unknown'

export function locationMembership(
  worktreeId: string,
  location: RevioLocation,
  facts: {
    repos: readonly Pick<Repo, 'id' | 'connectionId' | 'executionHostId'>[]
    repoWorktrees: Readonly<Record<string, readonly Pick<Worktree, 'id' | 'isArchived'>[]>>
    cloudEnvironmentIds: ReadonlySet<string>
    cloudEnvironmentIdsKnown: boolean
  }
): LocationMembership {
  const repoId = worktreeId.split('::')[0]
  const repo = facts.repos.find((candidate) => candidate.id === repoId)
  if (!repo || !facts.cloudEnvironmentIdsKnown) {
    return 'unknown'
  }
  if (isCloudRepo(repo, facts.cloudEnvironmentIds) !== (location === 'cloud')) {
    return 'no'
  }
  const worktree = facts.repoWorktrees[repo.id]?.find((candidate) => candidate.id === worktreeId)
  if (!worktree) {
    return 'unknown'
  }
  return worktree.isArchived ? 'no' : 'yes'
}

export type LocationFocusDecision =
  | { kind: 'keep' }
  | { kind: 'open'; worktreeId: string }
  | { kind: 'home' }
  /** The answer depends on data still loading; ask again when it changes. */
  | { kind: 'wait' }

/**
 * In the workspace layout, a location never shows another location's workspace. After a switch, or
 * when the open workspace stops belonging (archived, or it is the other location's), open the last
 * workspace used in this location, else Home. A Home the person chose stays Home.
 */
export function decideLocationFocus(input: {
  activeWorktreeId: string | null
  rememberedWorktreeId: string | null
  switched: boolean
  membership: (worktreeId: string) => LocationMembership
}): LocationFocusDecision {
  const { activeWorktreeId, rememberedWorktreeId, switched, membership } = input
  const active = activeWorktreeId ? membership(activeWorktreeId) : null
  if (active === 'yes') {
    return { kind: 'keep' }
  }
  if (active === 'unknown') {
    return { kind: 'wait' }
  }
  if (!switched && active === null) {
    return { kind: 'keep' }
  }
  const remembered = rememberedWorktreeId ? membership(rememberedWorktreeId) : null
  if (remembered === 'unknown') {
    return { kind: 'wait' }
  }
  if (rememberedWorktreeId && remembered === 'yes') {
    return { kind: 'open', worktreeId: rememberedWorktreeId }
  }
  return active === null ? { kind: 'keep' } : { kind: 'home' }
}
