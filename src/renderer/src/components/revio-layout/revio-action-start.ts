import type { ActionRunMode } from '../../../../shared/actions/repo-actions'
import type { ActionContext, Runnable } from '../../../../shared/actions/repo-action-runnables'
import {
  runRepoAction,
  runningRepoActionTab,
  stopRunsInOtherWorkspaces
} from '@/lib/repo-action-run'
import { repoWorktreeIds, rootWorktreeId, workspaceScriptEnv } from './revio-run-helpers'
import { spotlightTabId, toggleSpotlight } from './revio-spotlight'
import { prepareCloudDockForWorktree } from './revio-cloud-dock'
import { approveSharedActionRun } from '@/lib/shared-action-approval'
import { confirmWithAppDialog } from './revio-terminal-link-confirm'

/**
 * Starts one action the way the Run button does: the repository's run mode, Spotlight's root
 * checkout and the workspace's script variables. The Run button and agents' `orca action run`
 * share this, so both land in the same Run tab. Returns the tab the run started in, null when it
 * could not start, or 'declined' when the person did not approve a repository action's command.
 */
export async function startRunnable(
  context: ActionContext,
  entry: Runnable,
  runMode: ActionRunMode,
  spotlight: boolean
): Promise<{ tabId: string | null; worktreeId: string } | 'declined' | null> {
  // A cloud run stays in its sandbox; every other run is a command on this Mac.
  if (
    entry.group !== 'cloud' &&
    !(await approveSharedActionRun(context.sourceRepoId, entry.action, confirmWithAppDialog))
  ) {
    return 'declined'
  }
  if (runMode === 'nonconcurrent') {
    stopRunsInOtherWorkspaces(entry.worktreeId, repoWorktreeIds(context.sourceRepoId))
  }
  // Spotlight tests in the repository root: its actions run there, on the synced files.
  const target =
    spotlight && entry.group === 'local'
      ? { ...entry, worktreeId: rootWorktreeId(context.sourceRepoId) ?? entry.worktreeId }
      : entry
  if (spotlight && target !== entry && !spotlightTabId(context.worktreeId)) {
    toggleSpotlight(context.worktreeId)
  }
  const env = await workspaceScriptEnv(context.sourceRepoId, target)
  if (target.group === 'cloud') {
    // Its Run tab sits in the bottom panel, which reaches the sandbox over its ssh route.
    await prepareCloudDockForWorktree(target.worktreeId)
  }
  if (!runRepoAction(entry.action, target.worktreeId, env)) {
    return null
  }
  return {
    tabId: runningRepoActionTab(entry.action.id, target.worktreeId),
    worktreeId: target.worktreeId
  }
}
