import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { lastRunActionId, runRepoAction } from '@/lib/repo-action-run'
import { autoRunActionFor } from '../../../../shared/actions/repo-actions'
import { approveSharedActionRun } from '@/lib/shared-action-approval'
import { confirmWithAppDialog } from './revio-terminal-link-confirm'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { applySetupStatuses } from './revio-setup-status'
import { fixSetupWithAgent } from './revio-setup-fix'
import { setupFixLabel } from './RevioSetupFixItem'
import { closeDockTabsOfWorkspaces, closeStaleRemoteDockTabs } from './revio-dock-terminals'
import { removedWorktreeIds, worktreeListingOf } from './revio-dock-sweep'
import { closeOrphanDockTabs } from './revio-dock-orphans'
import { followCloudRuns, stopFollowingCloudRuns } from './revio-cloud-run-follow'
import { closeRevioCenterTerminalTabs } from './revio-center-terminal-sweep'

type LocalWorktree = { id: string; path: string; repoId: string }

function localWorktrees(): LocalWorktree[] {
  const state = useAppStore.getState()
  const local = new Set(
    state.repos.filter((repo) => getRepoExecutionHostId(repo) === 'local').map((repo) => repo.id)
  )
  return Object.entries(selectWorktreesByRepo(state) ?? {})
    .filter(([repoId]) => local.has(repoId))
    .flatMap(([, worktrees]) => worktrees ?? [])
    .filter((worktree) => !worktree.isMainWorktree)
    .map((worktree) => ({ id: worktree.id, path: worktree.path, repoId: worktree.repoId }))
}

/**
 * "Auto-run after setup" (Settings, Experimental): when a new workspace's setup
 * succeeds, start the repository's default action (the last one run, else the first made on this
 * Mac).
 */
async function autoRunDefaultAction(worktree: LocalWorktree): Promise<void> {
  const api = window.api.repoActions
  if (!api || useAppStore.getState().settings?.revioAutoRunAfterSetup !== true) {
    return
  }
  const listed = await api.list(worktree.repoId).catch(() => null)
  const action = autoRunActionFor(listed?.actions ?? [], lastRunActionId(worktree.repoId))
  if (!action) {
    return
  }
  // A shared action's script may have changed since the person last ran it.
  if (!(await approveSharedActionRun(worktree.repoId, action, confirmWithAppDialog))) {
    return
  }
  const env = await api.scriptEnv(worktree.repoId, worktree.path).catch(() => ({}))
  runRepoAction(action, worktree.id, env)
}

function handleSetupFinished(worktree: LocalWorktree, status: 'succeeded' | 'failed'): void {
  if (status === 'succeeded') {
    void autoRunDefaultAction(worktree)
    return
  }
  toast.error(
    translate(
      'auto.components.revioLayout.setupFailedToast',
      'Setup script failed. Check the setup tab for logs.'
    ),
    { action: { label: setupFixLabel(), onClick: () => void fixSetupWithAgent(worktree.id) } }
  )
}

/**
 * Follows setup runs for workspaces on this Mac: the signal behind the row's "Setting up…" /
 * "Initialization failed" and Auto-run after setup. Main polls the status files once for all
 * windows and grants each finished run to one window, so Auto-run never runs twice.
 */
export function RevioSetupWatcher(): null {
  // A removed (archived) workspace's dock Setup and Run tabs close with it.
  React.useEffect(() => {
    closeStaleRemoteDockTabs()
    void closeOrphanDockTabs()
    return useAppStore.subscribe((state, previous) => {
      if (
        state.workspaceSessionReady !== previous.workspaceSessionReady ||
        state.repos !== previous.repos
      ) {
        void closeOrphanDockTabs()
      }
      if (selectWorktreesByRepo(state) === selectWorktreesByRepo(previous)) {
        return
      }
      closeStaleRemoteDockTabs()
      void closeOrphanDockTabs()
      const removed = removedWorktreeIds(worktreeListingOf(previous), worktreeListingOf(state))
      if (removed.size > 0) {
        closeDockTabsOfWorkspaces(removed)
      }
    })
  }, [])
  // Terminal tabs an earlier session left in the center close: the center holds chats only.
  React.useEffect(() => {
    closeRevioCenterTerminalTabs()
    return useAppStore.subscribe((state, previous) => {
      if (
        state.workspaceSessionReady !== previous.workspaceSessionReady ||
        selectWorktreesByRepo(state) !== selectWorktreesByRepo(previous)
      ) {
        closeRevioCenterTerminalTabs()
      }
    })
  }, [])
  // While a cloud workspace is open, its Run tab follows the runs its agent starts.
  React.useEffect(() => {
    const follow = (worktreeId: string | null): void => {
      stopFollowingCloudRuns(worktreeId)
      if (worktreeId) {
        void followCloudRuns(worktreeId)
      }
    }
    follow(useAppStore.getState().activeWorktreeId)
    return useAppStore.subscribe((state, previous) => {
      if (state.activeWorktreeId !== previous.activeWorktreeId) {
        follow(state.activeWorktreeId)
      }
    })
  }, [])
  React.useEffect(() => {
    const api = window.api.repoActions
    if (!api?.setupWatch) {
      return
    }
    let live = true
    let watchedKey = ''
    const watch = (): void => {
      const paths = localWorktrees().map((worktree) => worktree.path)
      const key = paths.join('\n')
      if (key === watchedKey) {
        return
      }
      watchedKey = key
      void api
        .setupWatch(paths)
        .then((results) => {
          if (live) {
            applySetupStatuses(results)
          }
        })
        .catch(() => {})
    }
    const stopChanged = api.onSetupStatusChanged(({ path, status }) =>
      applySetupStatuses({ [path]: status })
    )
    const stopFinished = api.onSetupFinished(({ path, status, runId }) => {
      const worktree = localWorktrees().find((candidate) => candidate.path === path)
      if (!worktree) {
        return
      }
      void api
        .claimSetupFinished(path, runId)
        .then((mine) => {
          if (mine && live) {
            handleSetupFinished(worktree, status)
          }
        })
        .catch(() => {})
    })
    watch()
    const stopWorktrees = useAppStore.subscribe((state, previous) => {
      if (
        selectWorktreesByRepo(state) !== selectWorktreesByRepo(previous) ||
        state.repos !== previous.repos
      ) {
        watch()
      }
    })
    return () => {
      live = false
      stopWorktrees()
      stopChanged()
      stopFinished()
    }
  }, [])
  return null
}
