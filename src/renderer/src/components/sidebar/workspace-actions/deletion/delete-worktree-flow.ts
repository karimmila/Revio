import { useAppStore } from '@/store'
import {
  revioArchivesWithoutAsking,
  keepRevioArchiveRecord,
  unarchiveRevioWorkspace
} from '@/lib/revio-archive'
import { showArchiveKeptChangesToast } from '@/lib/revio-archive-kept-changes-toast'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { readUncommittedCount } from '@/components/revio-layout/revio-create-pr-precheck'
import { archiveCloudWorkspace } from '@/lib/revio-cloud-archive'
import { runSleepWorktree } from '../sleep/sleep-worktree-flow'
import { getAllWorktreesFromState, getWorktreeOnHostFromState } from '@/store/selectors'
import { toWorktreeRemovalTarget } from '../../../../../../shared/worktree/removal'
import { findRepoForHost } from '@/store/slices/repo-host-identity'
import {
  showNoDeletableWorkspacesToast,
  showWorkspaceListChangedToast
} from '../../worktree-list/listing/stale-workspace-list-toast'
import { getWorkspaceDeleteLineage } from './workspace-delete-lineage'
import { resolveSshWorkspaceForget } from './ssh-workspace-forget-resolution'
import { resolveWorktreeOperationRouteForHost } from '@/lib/worktree-operation-route'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { parseWorkspaceKey } from '../../../../../../shared/workspace-scope'
import {
  getWorktreeExecutionHostId,
  parseExecutionHostId
} from '../../../../../../shared/execution-host'
import {
  resolveWorktreeBatchDeleteTargets,
  toWorktreeDeleteIdentities,
  type WorktreeBatchDeleteOptions,
  type WorktreeDeleteIdentity,
  type WorktreeDeleteOptions
} from './worktree-delete-request'
import { runWorktreeDeletesInParallel } from './worktree-delete-execution'
import { runWorktreeDeleteWithToast } from './run-worktree-delete-with-toast'
import { collectRemovalUnsavedFiles } from '@/components/editor/save/flush/removal-unsaved-editor-files'
import { cloudEnvironmentIdsNow } from '@/lib/cloud-workspaces'
import type { Worktree } from '../../../../../../shared/worktree/types'

/** Standard Git-worktree deletion funnel; stale record/instance guards precede confirmation preferences. */
export function runWorktreeDelete(
  worktreeId: string,
  options: WorktreeDeleteOptions = {},
  asleepChecked = false
): void {
  const state = useAppStore.getState()
  // Qualify row actions by host; an unqualified id shared by two hosts resolves to nothing, never the first copy.
  const target = getWorktreeOnHostFromState(state, worktreeId, options.expectedHostId) ?? null
  const instanceChanged =
    Object.hasOwn(options, 'expectedInstanceId') &&
    target?.instanceId !== options.expectedInstanceId
  if (!target || instanceChanged) {
    // Folder callers own another deletion route; missing Git records cannot establish that those workspaces vanished.
    if (parseWorkspaceKey(worktreeId)?.type !== 'folder') {
      showWorkspaceListChangedToast()
    }
    return
  }
  if (!asleepChecked && parseExecutionHostId(target.hostId ?? null)?.kind === 'runtime') {
    // A cloud workspace archives through its sandbox's stop snapshot, so Unarchive can restore
    // it, in either layout; anything else (or a cloud sandbox mid-provision) goes on below.
    void archiveCloudWorkspace(target, { sleep: runSleepWorktree }).then((handled) => {
      if (!handled) {
        runWorktreeDelete(worktreeId, options, true)
      }
    })
    return
  }
  if (target.isMainWorktree) {
    const repo = findRepoForHost(state.repos, target.repoId, {
      hostId: target.hostId,
      settings: state.settings
    })
    // Git cannot remove primary checkouts; offer project removal while retaining files on disk.
    state.openModal('confirm-remove-folder', {
      repoId: target.repoId,
      displayName: repo?.displayName ?? target.displayName,
      workspaceName: target.displayName,
      hostId: getWorktreeExecutionHostId(target, repo ?? undefined)
    })
    return
  }
  const archiveCheckpoint = keepRevioArchiveRecord(target)
  if (target.hostId) {
    state.clearWorktreeDeleteState(worktreeId, target.hostId)
  } else {
    state.clearWorktreeDeleteState(worktreeId)
  }

  // This app's own SSH rows can only be forgotten; paired clients lack desktop SSH metadata, so their RPC must handle deletion instead.
  const matchingRepos = state.repos.filter((entry) => entry.id === target.repoId)
  const repo = target.hostId
    ? findRepoForHost(matchingRepos, target.repoId, { hostId: target.hostId })
    : matchingRepos.length === 1
      ? matchingRepos[0]
      : null
  const sshResolution = isPairedWebClientWindow()
    ? { kind: 'not-ssh' as const }
    : resolveSshWorkspaceForget({
        route: resolveWorktreeOperationRouteForHost(
          state,
          worktreeId,
          getWorktreeExecutionHostId(target, repo ?? undefined)
        ),
        sshTargetLabels: state.sshTargetLabels
      })
  if (sshResolution.kind !== 'not-ssh') {
    // Metadata-only forgetting cannot fail on registered lineage children, so skip their removal warning.
    state.openModal('forget-ssh-workspace', {
      worktreeId,
      // Why (STA-11912): a same-id replacement must not inherit this confirmation.
      worktreeDeleteIdentities: toWorktreeDeleteIdentities([target]),
      displayName: target.displayName,
      resolution: sshResolution
    })
    return
  }

  const deleteLineage = getWorkspaceDeleteLineage(
    target,
    getAllWorktreesFromState(state),
    state.worktreeLineageById
  )
  const hasLineageChildren = deleteLineage.descendants.length > 0
  // Skip-confirm preferences never authorize discarding unsaved editor text.
  const skipConfirm =
    ((state.settings?.skipDeleteWorktreeConfirm ?? false) ||
      revioArchivesWithoutAsking(target.id)) &&
    collectRemovalUnsavedFiles(useAppStore.getState, [target]).length === 0
  if (skipConfirm && !hasLineageChildren) {
    if (archiveCheckpoint) {
      // The workspace layout archives a workspace with uncommitted work: once that work is saved in
      // the archive checkpoint, the worktree may go without Force Delete. A save that did not land
      // (timeout) keeps the normal refusal, so nothing is lost.
      // Asked now, while the worktree is still there: the toast only mentions uncommitted
      // changes when git reports some.
      const uncommitted = readUncommittedCount(target.id).catch(() => null)
      void archiveCheckpoint.then((session) =>
        runWorktreeDeleteWithToast(toWorktreeRemovalTarget(target), target.displayName, {
          force: session !== null
        }).then(async (archived) => {
          if (archived && session !== null) {
            showArchiveKeptChangesToast(target.id, target.displayName, unarchiveRevioWorkspace, {
              openRestored: (restoredId) => activateAndRevealWorktree(restoredId),
              hadUncommittedChanges: ((await uncommitted) ?? 0) > 0
            })
          }
        })
      )
      return
    }
    void runWorktreeDeleteWithToast(toWorktreeRemovalTarget(target), target.displayName)
    return
  }
  state.openModal('delete-worktree', {
    worktreeId,
    worktreeDeleteIdentities: toWorktreeDeleteIdentities([target]),
    ...(hasLineageChildren
      ? {
          lineageDeleteIdentities: toWorktreeDeleteIdentities(deleteLineage.deleteAllTargets)
        }
      : {}),
    ...(hasLineageChildren ? { allowSkipConfirm: false } : {})
  })
}

export function runWorktreeBatchDelete(
  requestedWorktrees: readonly string[] | readonly WorktreeDeleteIdentity[],
  options: WorktreeBatchDeleteOptions = {}
): boolean {
  const state = useAppStore.getState()
  const resolved = resolveWorktreeBatchDeleteTargets(requestedWorktrees, (worktreeId, hostId) =>
    getWorktreeOnHostFromState(state, worktreeId, hostId)
  )
  if (!resolved) {
    showWorkspaceListChangedToast()
    return false
  }
  // A batch removal would delete a cloud sandbox's files before anything kept them; each cloud
  // workspace archives on its own path instead, with its restore point.
  const cloud = cloudEnvironmentIdsNow()
  const isCloud = (target: Pick<Worktree, 'hostId'>): boolean => {
    const host = parseExecutionHostId(target.hostId ?? null)
    return host?.kind === 'runtime' && cloud.has(host.environmentId)
  }
  for (const target of resolved.filter(isCloud)) {
    runWorktreeDelete(target.id, target.hostId ? { expectedHostId: target.hostId } : {})
  }
  const targets = resolved.filter((target) => !isCloud(target))
  if (targets.length === 0 && resolved.length > 0) {
    return true
  }

  if (targets.length === 0) {
    showNoDeletableWorkspacesToast()
    return false
  }

  for (const target of targets) {
    if (target.hostId) {
      state.clearWorktreeDeleteState(target.id, target.hostId)
    } else {
      state.clearWorktreeDeleteState(target.id)
    }
  }

  // Bulk removal can destroy multiple directories; retain explicit confirmation.
  const singleTargetLineage =
    targets.length === 1
      ? getWorkspaceDeleteLineage(
          targets[0],
          getAllWorktreesFromState(state),
          state.worktreeLineageById
        )
      : null
  const singleTargetHasLineageChildren = (singleTargetLineage?.descendants.length ?? 0) > 0
  const skipConfirm =
    !options.forceConfirm &&
    targets.length === 1 &&
    !singleTargetHasLineageChildren &&
    (state.settings?.skipDeleteWorktreeConfirm ?? false) &&
    collectRemovalUnsavedFiles(useAppStore.getState, targets).length === 0
  if (skipConfirm) {
    void runWorktreeDeletesInParallel(targets, {
      onForceDeleted: (deletedTarget) => options.onDeleted?.([deletedTarget])
    }).then((deletedTargets) => {
      if (deletedTargets.length > 0) {
        options.onDeleted?.(deletedTargets)
      }
    })
    return true
  }

  if (targets.length === 1) {
    state.openModal('delete-worktree', {
      worktreeId: targets[0].id,
      worktreeDeleteIdentities: toWorktreeDeleteIdentities(targets),
      ...(singleTargetHasLineageChildren && singleTargetLineage
        ? {
            lineageDeleteIdentities: toWorktreeDeleteIdentities(
              singleTargetLineage.deleteAllTargets
            )
          }
        : {}),
      ...(options.forceConfirm || singleTargetHasLineageChildren
        ? { allowSkipConfirm: false }
        : {}),
      ...(options.onDeleted ? { onDeleted: options.onDeleted } : {}),
      ...(options.forceOnConfirm === false ? { forceOnConfirm: false } : {})
    })
    return true
  }

  state.openModal('delete-worktree', {
    worktreeIds: targets.map((target) => target.id),
    worktreeDeleteIdentities: toWorktreeDeleteIdentities(targets),
    allowSkipConfirm: false,
    ...(options.onDeleted ? { onDeleted: options.onDeleted } : {}),
    ...(options.forceOnConfirm === false ? { forceOnConfirm: false } : {})
  })
  return true
}
