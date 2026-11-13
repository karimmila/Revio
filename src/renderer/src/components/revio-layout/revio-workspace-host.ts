import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import {
  getWorktreeExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../../../shared/execution-host'

/** True when the workspace runs on an SSH host or a cloud sandbox rather than this Mac. */
export function isRemoteWorkspace(worktreeId: string | null): boolean {
  const state = useAppStore.getState()
  const worktree = worktreeId
    ? findWorktreeById(selectWorktreesByRepo(state), worktreeId)
    : undefined
  if (!worktree) {
    return false
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  return getWorktreeExecutionHostId(worktree, repo) !== LOCAL_EXECUTION_HOST_ID
}
