import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { runBackgroundWorktreeCreation } from '@/lib/workspace/creation/worktree-creation-flow'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../shared/execution-host'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'
import { notifyArchiveChanged } from './revio-archive-events'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import {
  cloudWorktreeIdsOnBranch,
  resumeChatsInCloudWorkspace,
  settledCloudWorktree
} from './cloud-restored-workspace'

/**
 * Unarchive a cloud workspace: a new cloud workspace on the archived branch whose sandbox starts
 * from the kept stop snapshot (main falls back to the build and the branch when it expired).
 */
export async function unarchiveCloudWorkspace(record: ArchivedWorkspace): Promise<boolean> {
  const restore = record.cloudRestore
  const branch = record.branch
  const repo = useAppStore.getState().repos.find((candidate) => candidate.id === record.repoId)
  if (!restore || !branch || !repo || !window.api.cloud) {
    return false
  }
  try {
    await window.api.cloud.prepareRestore({
      repoId: record.repoId,
      branch,
      snapshotId: restore.snapshotId,
      commit: record.archiveCommit
    })
  } catch (error) {
    toast.error(
      translate('auto.lib.revioArchive.unarchiveFailed', 'Could not unarchive {{value0}}', {
        value0: record.displayName
      }),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
  const before = cloudWorktreeIdsOnBranch(branch)
  const creationId = runBackgroundWorktreeCreation(
    cloudRestoreRequest(record, branch, restore.projectId, repo)
  )
  forgetRecordOnceRestored(record, creationId)
  const chats = record.chats ?? []
  if (chats.length > 0) {
    void settledCloudWorktree(creationId, branch, before).then((worktreeId) =>
      worktreeId ? resumeChatsInCloudWorkspace(worktreeId, record.id, chats) : undefined
    )
  }
  return true
}

const RESTORE_WATCH_MS = 15 * 60_000

/**
 * The record (and with it the restore snapshot, which main deletes) goes only once the new
 * workspace exists: a failed or dismissed create keeps it, so Unarchive can be tried again.
 */
function forgetRecordOnceRestored(record: ArchivedWorkspace, creationId: string): void {
  const restoredBranch = `refs/heads/${record.branch}`
  const settle = (): boolean => {
    const state = useAppStore.getState()
    if (state.pendingWorktreeCreations[creationId]) {
      return false
    }
    const restored = Object.values(selectWorktreesByRepo(state)).some((worktrees) =>
      (worktrees ?? []).some(
        (worktree) =>
          worktree.branch === restoredBranch &&
          parseExecutionHostId(worktree.hostId ?? null)?.kind === 'runtime'
      )
    )
    if (restored) {
      void window.api.revioArchive?.remove(record.id).then(notifyArchiveChanged)
    }
    return true
  }
  if (settle()) {
    return
  }
  const stop = useAppStore.subscribe(() => {
    if (settle()) {
      stop()
      clearTimeout(timer)
    }
  })
  const timer = setTimeout(stop, RESTORE_WATCH_MS)
}

export function cloudRestoreRequest(
  record: Pick<ArchivedWorkspace, 'repoId' | 'displayName'>,
  branch: string,
  projectId: string,
  repo: Parameters<typeof getRepoExecutionHostId>[0]
): WorktreeCreationRequest {
  return {
    repoId: record.repoId,
    ephemeralVmRecipe: {
      sourceRepoId: record.repoId,
      recipeId: VERCEL_CLOUD_RECIPE_ID,
      projectId,
      checkoutMode: 'provisioned-root'
    },
    worktreeCreateProgressMode: 'indeterminate',
    // The one "Setting up workspace…" line a cloud create shows, not the recipe's step list.
    simpleCloudSetup: true,
    name: branch.split('/').pop() || record.displayName,
    branchNameOverride: branch,
    displayName: record.displayName,
    displayNameKind: 'user',
    setupDecision: 'skip',
    hookPreparation: {
      executionHostId: getRepoExecutionHostId(repo),
      confirmVmRecipe: true
    },
    agent: null,
    setupOnly: false,
    pendingFirstAgentMessageRename: false,
    note: '',
    startupPlan: null,
    quickPrompt: '',
    quickTelemetry: null
  }
}
