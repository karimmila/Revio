import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { resolveActionContext } from '@/lib/repo-action-run'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { cloudActionRunsFollow } from '../../../../shared/cloud/cloud-action-runs'
import { isDockTabForWorkspace, isRemoteWorkspace } from './revio-dock-terminals'
import { prepareCloudDockForWorktree } from './revio-cloud-dock'
import { startInRevioDockInBackground } from './revio-dock-background-start'

/** The Run tab that follows a cloud workspace's agent runs, per workspace. */
const followTabs = new Map<string, string>()

function runTitle(): string {
  return translate('auto.lib.repoActionRun.runTab', 'Run')
}

function hasRunTab(worktreeId: string): boolean {
  const title = runTitle()
  return (useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).some(
    (tab) => tab.customTitle === title && isDockTabForWorkspace(tab.id, worktreeId)
  )
}

async function hasCloudActions(worktreeId: string): Promise<boolean> {
  const context = await resolveActionContext(worktreeId).catch(() => null)
  if (context?.kind !== 'cloud') {
    return false
  }
  const listed = await window.api.repoActions?.list(context.sourceRepoId).catch(() => null)
  return listed?.actions.some((action) => action.targets.includes('cloud')) ?? false
}

/**
 * While a cloud workspace is open, its Run tab follows the runs its agent starts in the sandbox
 * (the action files log them there). This Mac opens the ssh session and reads; the sandbox never
 * calls back. A Run tab the workspace already has (the person's own run) is left alone.
 */
export async function followCloudRuns(worktreeId: string): Promise<void> {
  if (!isRemoteWorkspace(worktreeId) || hasRunTab(worktreeId)) {
    return
  }
  if (!(await hasCloudActions(worktreeId)) || !(await prepareCloudDockForWorktree(worktreeId))) {
    return
  }
  // The person may have moved on, or started a run, while the route was read.
  if (useAppStore.getState().activeWorktreeId !== worktreeId || hasRunTab(worktreeId)) {
    return
  }
  const tabId = startInRevioDockInBackground(
    worktreeId,
    runTitle(),
    cloudActionRunsFollow(
      translate(
        'auto.components.revioLayout.cloudRunsWaiting',
        'No runs yet. Runs you or the agent start show here.'
      )
    ),
    undefined,
    { reveal: false }
  )
  if (tabId) {
    followTabs.set(worktreeId, tabId)
  }
}

/** Ends the following of every workspace but `keep`: its ssh session closes with its tab. */
export function stopFollowingCloudRuns(keep: string | null): void {
  for (const [worktreeId, tabId] of followTabs) {
    if (worktreeId === keep) {
      continue
    }
    followTabs.delete(worktreeId)
    // Gone already when a person's run replaced it under the same title.
    const state = useAppStore.getState()
    if (
      (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).some((tab) => tab.id === tabId)
    ) {
      state.closeTab(tabId, { recordInteraction: false })
    }
  }
}
