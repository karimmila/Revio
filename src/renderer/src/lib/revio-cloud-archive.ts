import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import { parseExecutionHostId } from '../../../shared/execution-host'
import type { EphemeralVmRuntimeRecord } from '../../../shared/ephemeral-vm-runtimes'
import type { ArchivedChat, ArchivedWorkspace } from '../../../shared/revio-archive-types'
import type { Worktree } from '../../../shared/worktree/types'
import { notifyArchiveChanged } from './revio-archive-events'
import { archivedChatsInStore } from './revio-archive-chats'
import { getWorktreeDeleteStateKey } from '@/store/slices/worktrees/teardown/worktree-delete-state'
import { closeDockTabsOfWorkspaces } from '@/components/revio-layout/revio-dock-terminals'

export type AsleepCloudRuntime = Pick<
  EphemeralVmRuntimeRecord,
  | 'id'
  | 'recipeId'
  | 'status'
  | 'runtimeEnvironmentId'
  | 'repoId'
  | 'projectId'
  | 'cleanupStatus'
  | 'workspaceName'
> & { recipeResult?: { userData?: Record<string, unknown> } }

/** What the cloud recipe recorded at create: the branch and the commit it started at. */
type CloudWorkspaceFacts = { branch?: string; startCommit?: string; workspaceName?: string }

function cloudWorkspaceFacts(runtime: AsleepCloudRuntime): CloudWorkspaceFacts {
  const userData = runtime.recipeResult?.userData ?? {}
  return {
    ...(typeof userData.branch === 'string' ? { branch: userData.branch } : {}),
    ...(typeof userData.startCommit === 'string' ? { startCommit: userData.startCommit } : {}),
    ...(runtime.workspaceName ? { workspaceName: runtime.workspaceName } : {})
  }
}

export type ArchivableCloudRuntime = {
  id: string
  repoId: string
  projectId: string
  /** False while running: the window puts it to sleep first, so its stop snapshot holds everything. */
  asleep: boolean
  facts: CloudWorkspaceFacts
}

/**
 * Runtime states whose sandbox may still exist and hold work. Only `running` is put to sleep by
 * the window first; for the rest main stops whatever still runs before keeping the snapshot.
 */
const ARCHIVABLE_STATUSES = new Set<AsleepCloudRuntime['status']>([
  'running',
  'suspended',
  'resume_failed',
  'suspend_failed',
  'failed',
  'cleanup_pending',
  'cleanup_failed'
])

/** The cloud sandbox behind a workspace while it may still exist; null otherwise. */
export function cloudRuntimeFor(
  target: Pick<Worktree, 'hostId'>,
  runtimes: readonly AsleepCloudRuntime[]
): ArchivableCloudRuntime | null {
  const host = parseExecutionHostId(target.hostId ?? null)
  if (host?.kind !== 'runtime') {
    return null
  }
  const runtime = runtimes.find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      entry.runtimeEnvironmentId === host.environmentId &&
      entry.cleanupStatus !== 'succeeded'
  )
  if (
    !runtime ||
    !ARCHIVABLE_STATUSES.has(runtime.status) ||
    !runtime.repoId ||
    !runtime.projectId
  ) {
    return null
  }
  return {
    id: runtime.id,
    repoId: runtime.repoId,
    projectId: runtime.projectId,
    asleep: runtime.status !== 'running',
    facts: cloudWorkspaceFacts(runtime)
  }
}

const COMMIT = /^[0-9a-f]{7,64}$/

/**
 * The archive record of an asleep cloud workspace. Its server is down, so the row may hold no
 * branch or HEAD; the recipe's own record of the branch and start commit fills in. Null when
 * neither knows the branch.
 */
export function asleepCloudArchiveRecord(
  target: Pick<Worktree, 'id' | 'displayName' | 'branch' | 'head'>,
  runtime: { repoId: string; projectId: string; facts?: CloudWorkspaceFacts },
  restoreSnapshotId: string | null,
  now: number,
  chats: readonly ArchivedChat[] = []
): ArchivedWorkspace | null {
  const facts = runtime.facts ?? {}
  const rowBranch = target.branch ? target.branch.replace(/^refs\/heads\//, '') : null
  const branch = rowBranch ?? facts.branch ?? null
  const commit = COMMIT.test(target.head) ? target.head : facts.startCommit
  if (!branch || !commit || !COMMIT.test(commit)) {
    return null
  }
  return {
    id: target.id,
    repoId: runtime.repoId,
    displayName: rowBranch ? target.displayName : (facts.workspaceName ?? target.displayName),
    branch,
    archiveCommit: commit,
    archivedAt: now,
    cloud: true,
    cloudRestore: { projectId: runtime.projectId, snapshotId: restoreSnapshotId },
    ...(chats.length > 0 ? { chats: [...chats] } : {})
  }
}

export type ArchivableCloudWorkspace = Pick<
  Worktree,
  'id' | 'repoId' | 'hostId' | 'displayName' | 'branch' | 'head' | 'isMainWorktree'
>

export type CloudArchiveDeps = {
  /** The window's own Sleep: stops the workspace's agents and terminals, then the sandbox. */
  sleep: (worktreeId: string) => Promise<readonly { completed: boolean }[]>
  /** Test seam for the wait until the runtime record says the sandbox is asleep. */
  pause?: (ms: number) => Promise<void>
}

const ASLEEP_WAIT_MS = 2 * 60_000
const ASLEEP_POLL_MS = 1_000

/**
 * Archive a cloud workspace so it can always come back. A running sandbox is first put to sleep
 * the way Sleep does it, so Vercel writes a stop snapshot holding its uncommitted work; then main
 * keeps that snapshot as the restore point and deletes the sandbox through Vercel's API (an asleep
 * sandbox has no server to remove the workspace through). The sandbox was the whole host, so its
 * project goes from this Mac the way a forgotten host's does (also clearing the VM's runtime
 * record, key and mirror). The row reads "Archiving…" throughout. Resolves false when this is not
 * a cloud workspace whose sandbox may still exist, so the normal archive runs.
 */
export async function archiveCloudWorkspace(
  target: ArchivableCloudWorkspace,
  deps: CloudArchiveDeps
): Promise<boolean> {
  const runtimes = await window.api.ephemeralVm?.listRuntimes?.().catch(() => null)
  const runtime = runtimes ? cloudRuntimeFor(target, runtimes) : null
  if (!runtime || !window.api.cloud) {
    return false
  }
  // Read first: putting the workspace to sleep stops its agents, and the project's removal takes
  // the chat tabs with it, so later there is no chat left to record.
  const chats = archivedChatsInStore(target.id)
  markArchiving(target)
  try {
    if (!runtime.asleep) {
      await sleepBeforeArchive(target.id, runtime.id, deps)
    }
    const { restoreSnapshotId } = await window.api.cloud.retireAsleepSandbox(runtime.id)
    const record = asleepCloudArchiveRecord(target, runtime, restoreSnapshotId, Date.now(), chats)
    if (record) {
      await window.api.revioArchive?.add(record)
    }
    if (target.hostId) {
      // Every row on this host lived in the deleted sandbox, so the whole VM project goes; its
      // removal finds the sandbox already gone and skips the unreachable server.
      await useAppStore.getState().removeProject(target.repoId, {
        hostId: target.hostId,
        errorFeedback: 'toast'
      })
      useAppStore.getState().clearWorktreeDeleteState(target.id, target.hostId)
      // The sandbox was the workspace's whole repository, so the dock's own sweep, which reads a
      // repository's list, never sees this workspace go.
      closeDockTabsOfWorkspaces(new Set([target.id]))
    }
    notifyArchiveChanged()
  } catch (error) {
    useAppStore.getState().clearWorktreeDeleteState(target.id, target.hostId)
    toast.error(
      translate('auto.lib.revioCloudArchive.archiveFailed', 'Could not archive {{value0}}', {
        value0: target.displayName
      }),
      { description: error instanceof Error ? error.message : String(error) }
    )
  }
  return true
}

async function sleepBeforeArchive(
  worktreeId: string,
  runtimeId: string,
  deps: CloudArchiveDeps
): Promise<void> {
  const results = await deps.sleep(worktreeId)
  if (results.length === 0 || results.some((result) => !result.completed)) {
    throw new Error('The workspace could not be put to sleep, so it was kept.')
  }
  const pause = deps.pause ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const deadline = Date.now() + ASLEEP_WAIT_MS
  while (Date.now() < deadline) {
    const runtimes = await window.api.ephemeralVm.listRuntimes()
    const runtime = runtimes.find((entry) => entry.id === runtimeId)
    if (runtime?.status === 'suspended') {
      return
    }
    await pause(ASLEEP_POLL_MS)
  }
  throw new Error('The workspace did not go to sleep in time, so it was kept.')
}

/** The row's "Archiving…": the same delete state a normal archive shows. */
function markArchiving(target: ArchivableCloudWorkspace): void {
  useAppStore.setState((state) => {
    const key = getWorktreeDeleteStateKey(state, target.id, target.hostId)
    return {
      deleteStateByWorktreeId: {
        ...state.deleteStateByWorktreeId,
        [key]: {
          isDeleting: true,
          phase: 'deleting',
          ...(target.hostId ? { executionHostId: target.hostId } : {}),
          error: null,
          canForceDelete: false,
          forceDeleteReason: null
        }
      }
    }
  })
}
