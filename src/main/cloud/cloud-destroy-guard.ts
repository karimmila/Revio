import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import type { EphemeralVmRuntimeRecord } from '../../shared/ephemeral-vm-runtimes'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import type { ArchivedChat, ArchivedWorkspace } from '../../shared/revio-archive-types'
import { addArchivedWorkspace, readArchivedWorkspaces } from '../revio/revio-archive-store'
import { releaseRestorePoint, retireCloudSandboxForArchive } from './cloud-archive-restore'
import type { waitForSandboxToSettle } from './cloud-sandbox-settle'
import { cloudInfo } from './cloud-log'

/**
 * The one reason a cloud sandbox may go with nothing kept: a create that failed or was
 * dismissed before it finished holds no work yet.
 */
export const CLOUD_DISCARD_FAILED_CREATE = 'failed-create'
export type CloudSandboxDiscard = typeof CLOUD_DISCARD_FAILED_CREATE

const COMMIT = /^[0-9a-f]{7,64}$/

/** The archive record for a cloud workspace archived from its runtime record alone. */
export function runtimeArchiveRecord(
  runtime: Pick<
    EphemeralVmRuntimeRecord,
    'id' | 'repoId' | 'projectId' | 'workspaceId' | 'workspaceName'
  > & { recipeResult?: { userData?: Record<string, unknown> } },
  restoreSnapshotId: string,
  now: number,
  chats: readonly ArchivedChat[] = []
): ArchivedWorkspace | null {
  const userData = runtime.recipeResult?.userData
  const fact = (key: string): string | null => {
    const value = userData?.[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  const commit = fact('startCommit')
  const branch = fact('branch')
  if (!runtime.repoId || !runtime.projectId || !commit || !COMMIT.test(commit)) {
    return null
  }
  return {
    id: runtime.workspaceId ?? runtime.id,
    repoId: runtime.repoId,
    displayName: runtime.workspaceName ?? branch ?? runtime.id,
    branch,
    archiveCommit: commit,
    archivedAt: now,
    cloud: true,
    cloudRestore: { projectId: runtime.projectId, snapshotId: restoreSnapshotId },
    ...(chats.length > 0 ? { chats: [...chats] } : {})
  }
}

/**
 * Every path in the window that destroys a VM runtime (removing a workspace or its project,
 * the VM settings' cleanup, a batch delete, …) ends in `ephemeralVm:cleanup`, and for a cloud
 * workspace its destroy deletes the sandbox with all its snapshots. On 2026-11-12 a project-style
 * "Archive" did exactly that and the workspace's work was lost. So before any such destroy, this
 * archives the workspace: the sandbox is retired keeping its stop snapshot as a restore point and
 * an archive record is written, so Home can unarchive it. The destroy then finds the sandbox gone
 * and only clears this Mac's own state. The window passes the workspace's chats, which only it
 * knows, so Unarchive brings them back too. A sandbox already gone (the window's own archive retired
 * it first) needs nothing. Throws, keeping the sandbox, when no restore point could be kept.
 */
export async function archiveCloudRuntimeBeforeDestroy(
  userDataPath: string,
  runtimeId: string,
  discard: CloudSandboxDiscard | undefined,
  settle: Parameters<typeof waitForSandboxToSettle>[2] = {},
  chats: readonly ArchivedChat[] = []
): Promise<void> {
  const runtime = listEphemeralVmRuntimes(userDataPath).find((entry) => entry.id === runtimeId)
  if (!runtime || runtime.recipeId !== VERCEL_CLOUD_RECIPE_ID || runtime.status === 'cleaned') {
    return
  }
  if (discard === CLOUD_DISCARD_FAILED_CREATE) {
    // The window only says so. Main believes it for a runtime no workspace was ever attached to:
    // that sandbox holds no work. With a workspace attached the claim is ignored, so a wrong or
    // forged flag still leaves a restore point.
    if (!runtime.workspaceId) {
      cloudInfo(`discarding ${runtime.workspaceName ?? runtime.id}: its create did not finish`)
      return
    }
    cloudInfo(
      `${runtime.workspaceName ?? runtime.id} has a workspace; archiving it, not discarding`
    )
  }
  const { restoreSnapshotId } = await retireCloudSandboxForArchive(userDataPath, runtimeId, settle)
  if (!restoreSnapshotId) {
    return
  }
  const record = runtimeArchiveRecord(runtime, restoreSnapshotId, Date.now(), chats)
  if (!record) {
    // The restore point stays in the ledger (inventory shows it in use), so nothing is lost.
    cloudInfo(
      `kept restore point ${restoreSnapshotId}; no branch facts to write its archive record`
    )
    return
  }
  const dropped = addArchivedWorkspace(userDataPath, record)
  const stillNamed = new Set(
    readArchivedWorkspaces(userDataPath).map((entry) => entry.cloudRestore?.snapshotId)
  )
  for (const old of dropped) {
    const snapshotId = old.cloudRestore?.snapshotId
    if (snapshotId && !stillNamed.has(snapshotId)) {
      await releaseRestorePoint(snapshotId)
    }
  }
  cloudInfo(`archived ${record.displayName} before its destroy; restore point ${restoreSnapshotId}`)
}
