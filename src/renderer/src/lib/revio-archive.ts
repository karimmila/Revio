import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { isCloudRepo, cloudEnvironmentIdsNow } from '@/lib/cloud-workspaces'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'
import { restoreArchiveCheckpoint, saveArchiveCheckpoint } from './revio-archive-checkpoint'
import { dismissArchiveToast } from './revio-archive-kept-changes-toast'
import { archivedChatsInStore, reopenArchivedChats } from './revio-archive-chats'
import {
  restoreScenario,
  restoredWorkspaceName,
  type ConfirmRestoreToNewBranch
} from './revio-archive-restore'
import type { Worktree } from '../../../shared/worktree/types'
import { notifyArchiveChanged, onRevioArchiveChanged } from './revio-archive-events'
import { unarchiveCloudWorkspace } from './revio-cloud-unarchive'
import { confirmWorkspaceSetupDecision } from './workspace-setup-trust'
import type { SetupDecision } from '../../../shared/worktree/create-types'
import { selectWorktreeAgentActivitySummary } from '@/components/sidebar/workspace-card/activity/worktree-agent-activity-summary'

// The delete flow may ask first; a record is kept only once the worktree is really gone.
const WATCH_MS = 10 * 60_000

/**
 * The workspace layout keeps an archived workspace: its branch, HEAD (archive_commit) and name, so
 * "Only archived" lists it and Unarchive brings it back. Orca's archive removes the worktree, so
 * the record is written here once the removal lands.
 */
/**
 * The workspace layout archives without asking unless an agent in the workspace is still working or
 * waiting on the person; then Orca's confirm (stop agents and archive) still shows.
 */
export function revioArchivesWithoutAsking(worktreeId: string): boolean {
  if (typeof document === 'undefined' || document.documentElement.dataset.revioLayout !== 'true') {
    return false
  }
  const activity = selectWorktreeAgentActivitySummary(useAppStore.getState(), worktreeId)
  return !activity.hasLiveWorking && !activity.hasPermission && !activity.hasLiveMonitoring
}

/**
 * Returns the archive checkpoint save (the session, or null when there was nothing to keep), or
 * null when no record is kept.
 */
export function keepRevioArchiveRecord(target: Worktree): Promise<string | null> | null {
  const state = useAppStore.getState()
  if (state.settings?.revioLayout !== true || !window.api.revioArchive) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === target.repoId)
  // Read before removal: the chat tabs go with the worktree.
  const chats = archivedChatsInStore(target.id)
  const record: ArchivedWorkspace = {
    id: target.id,
    repoId: target.repoId,
    displayName: target.displayName,
    branch: target.branch ? target.branch.replace(/^refs\/heads\//, '') : null,
    archiveCommit: target.head,
    archivedAt: Date.now(),
    cloud: repo ? isCloudRepo(repo, cloudEnvironmentIdsNow()) : false,
    ...(chats.length > 0 ? { chats } : {})
  }
  if (!/^[0-9a-f]{7,64}$/.test(record.archiveCommit)) {
    return null
  }
  // The workspace layout keeps the workspace's uncommitted and untracked work as an archive
  // checkpoint.
  const checkpoint = record.cloud ? null : saveArchiveCheckpoint(target.path, record.archivedAt)
  const stop = useAppStore.subscribe((next) => {
    if (!findWorktreeById(selectWorktreesByRepo(next), target.id)) {
      stop()
      clearTimeout(timer)
      void Promise.resolve(checkpoint)
        .then((session) =>
          window.api.revioArchive?.add(session ? { ...record, checkpointSession: session } : record)
        )
        .then(notifyArchiveChanged)
    }
  })
  const timer = setTimeout(stop, WATCH_MS)
  return checkpoint
}

export { onRevioArchiveChanged }

type Reopen = { name: string; branch?: string; base?: string; compareBaseRef?: string }

/**
 * Unarchive makes a worktree, so the setup script needs the approval New Workspace asks for.
 * Without it the host ran the archived branch's orca.yaml setup with no prompt, even after the
 * person had pressed Skip. The host runs the script only when it hashes to what was approved here,
 * and anything that goes wrong means no setup run.
 */
async function unarchiveSetupApproval(
  repoId: string
): Promise<{ setupDecision: SetupDecision; approvedSetupHash?: string }> {
  try {
    const confirmed = await confirmWorkspaceSetupDecision(
      useAppStore.getState,
      repoId,
      'inherit',
      undefined,
      () => false
    )
    if (confirmed === 'cancelled') {
      return { setupDecision: 'skip' }
    }
    return {
      setupDecision: confirmed.setupDecision,
      ...(confirmed.approvedSetupHash !== undefined
        ? { approvedSetupHash: confirmed.approvedSetupHash }
        : {})
    }
  } catch {
    return { setupDecision: 'skip' }
  }
}

async function reopenWorktree(
  record: ArchivedWorkspace,
  reopen: Reopen
): Promise<{ id: string; path: string; head: string }> {
  const { setupDecision, approvedSetupHash } = await unarchiveSetupApproval(record.repoId)
  const result = await useAppStore
    .getState()
    .createWorktree(
      record.repoId,
      reopen.name,
      reopen.base,
      setupDecision,
      undefined,
      'sidebar',
      record.displayName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      reopen.branch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      reopen.compareBaseRef,
      {
        ...(reopen.branch ? { branchIntent: 'open-existing-v2' as const } : {}),
        ...(approvedSetupHash !== undefined ? { approvedSetupHash } : {})
      }
    )
  return { id: result.worktree.id, path: result.worktree.path, head: result.worktree.head }
}

/** Where a new branch for a restored workspace compares to: the repo's base, not the archive SHA. */
async function compareBaseFor(repoId: string): Promise<string | undefined> {
  const repo = useAppStore.getState().repos.find((candidate) => candidate.id === repoId)
  if (repo?.worktreeBaseRef) {
    return repo.worktreeBaseRef
  }
  const found = await window.api.repos.getBaseRefDefault({ repoId }).catch(() => null)
  return found?.defaultBaseRef ?? undefined
}

/**
 * Unarchive: a new worktree on the archived branch (Orca's open-existing-branch create), then the
 * record goes. When that branch is taken, gone or moved, the workspace layout asks "Restore to new
 * branch?" and reopens the work on a new branch at the archive commit instead. A detached
 * workspace has no branch to reopen; a cloud one comes back as a new cloud workspace.
 */
export async function unarchiveRevioWorkspace(
  record: ArchivedWorkspace,
  confirmNewBranch?: ConfirmRestoreToNewBranch,
  /** Undo passes this to go back to the workspace the person was in when they archived it. */
  onRestored?: (worktreeId: string) => void
): Promise<boolean> {
  if (record.cloud) {
    return unarchiveCloudWorkspace(record)
  }
  if (!record.branch) {
    return false
  }
  const state = useAppStore.getState()
  const repo = state.repos.find((candidate) => candidate.id === record.repoId)
  const inUse = (selectWorktreesByRepo(state)?.[record.repoId] ?? []).map((worktree) =>
    worktree.branch.replace(/^refs\/heads\//, '')
  )
  const scenario = confirmNewBranch && repo ? await restoreScenario(record, repo.path, inUse) : null
  if (scenario && !(await confirmNewBranch?.(scenario))) {
    return false
  }
  let created: { id: string; path: string; head: string }
  try {
    created = await reopenWorktree(
      record,
      scenario
        ? {
            name: restoredWorkspaceName(record),
            base: record.archiveCommit,
            compareBaseRef: await compareBaseFor(record.repoId)
          }
        : { name: record.branch.split('/').pop() || record.displayName, branch: record.branch }
    )
  } catch (error) {
    toast.error(
      translate('auto.lib.revioArchive.unarchiveFailed', 'Could not unarchive {{value0}}', {
        value0: record.displayName
      }),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
  if (record.checkpointSession) {
    await restoreArchiveCheckpoint(created, record)
  }
  if (record.chats?.length) {
    void reopenArchivedChats(created.id, record.id, record.chats)
  }
  // The new id: on a new branch the workspace comes back under another path.
  await window.api.revioArchive?.remove(record.id, created.id)
  notifyArchiveChanged()
  onRestored?.(created.id)
  return true
}

/**
 * Removes an archived workspace for good: the record goes, and main deletes its cloud restore
 * snapshot or every local archive checkpoint ref it owns. The branch stays. The caller has asked
 * the person first.
 */
export async function deleteArchivedWorkspace(record: ArchivedWorkspace): Promise<boolean> {
  try {
    await window.api.revioArchive?.delete(record.id)
  } catch (error) {
    toast.error(
      translate(
        'auto.components.sidebar.delete.worktree.toast.1d0fa5c0a5',
        'Failed to delete workspace {{value0}}',
        { value0: record.displayName }
      ),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
  // Its Undo would restore a workspace that is gone.
  dismissArchiveToast(record.id)
  notifyArchiveChanged()
  return true
}
