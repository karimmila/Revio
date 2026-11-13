import { useAppStore } from '@/store'
import { archiveCloudWorkspace, type ArchivableCloudWorkspace } from '@/lib/revio-cloud-archive'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { ExecutionHostId } from '../../../../../../shared/execution-host'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { runSleepWorktree } from '../sleep/sleep-worktree-flow'

export type CloudHostRow = ArchivableCloudWorkspace & Pick<Worktree, 'ephemeralVmCheckoutMode'>

/** The workspace a cloud host holds: its sandbox's root checkout, else any row on that host. */
export function cloudHostWorkspace(
  state: { worktreesByRepo: Readonly<Record<string, readonly CloudHostRow[] | undefined>> },
  repoId: string,
  hostId: ExecutionHostId
): ArchivableCloudWorkspace | null {
  const rows = (selectWorktreesByRepo(state)[repoId] ?? []).filter(
    (worktree) => worktree.hostId === hostId
  )
  return (
    rows.find(
      (worktree) =>
        worktree.isMainWorktree || worktree.ephemeralVmCheckoutMode === 'provisioned-root'
    ) ??
    rows[0] ??
    null
  )
}

/**
 * A cloud project is one workspace's sandbox, so removing it is archiving that workspace with a
 * restore point. Project removal runs only when no archivable row or runtime is left; main's
 * destroy guard still keeps a restore point for any sandbox that remains.
 */
export async function archiveCloudProject(repoId: string, hostId: ExecutionHostId): Promise<void> {
  const workspace = cloudHostWorkspace(useAppStore.getState(), repoId, hostId)
  if (workspace && (await archiveCloudWorkspace(workspace, { sleep: runSleepWorktree }))) {
    return
  }
  await useAppStore.getState().removeProject(repoId, { hostId, errorFeedback: 'toast' })
}
