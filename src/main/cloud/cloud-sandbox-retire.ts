import { Snapshot, type Sandbox } from '@vercel/sandbox'
import { bestEffort } from './cloud-log'
import { restorePointIds } from './cloud-restore-points'

/**
 * Deletes a sandbox for good: first the snapshots Vercel took on its own when the sandbox stopped
 * (persistent sandboxes keep one per stop, about 1.7 GB, for 30 days), then the sandbox. A build's
 * own snapshot is kept: it is the repository's build, made on purpose. So is every archived
 * workspace's restore point, whichever path asks for the delete.
 */
/** Every snapshot of the sandbox: one page holds 50, and a long-lived sandbox has more. */
export async function listAllSnapshots(
  sandbox: Pick<Sandbox, 'listSnapshots'>
): Promise<Awaited<ReturnType<Sandbox['listSnapshots']>>['snapshots']> {
  return (await sandbox.listSnapshots({ limit: 50 })).toArray()
}

export async function retireSandbox(
  sandbox: Sandbox,
  scope: { token: string; teamId: string; projectId: string },
  /** keepSnapshotId: one snapshot to keep, an archived workspace's restore point. */
  options: { keepSnapshots?: boolean; keepSnapshotId?: string } = {}
): Promise<void> {
  if (!options.keepSnapshots) {
    const listed = await listAllSnapshots(sandbox).catch((error: unknown) => {
      bestEffort(`Listing snapshots of ${sandbox.name}`)(error)
      return []
    })
    const restorePoints = restorePointIds()
    for (const snapshot of listed) {
      if (
        snapshot.status !== 'deleted' &&
        snapshot.id !== options.keepSnapshotId &&
        !restorePoints.has(snapshot.id)
      ) {
        await Snapshot.get({ ...scope, snapshotId: snapshot.id })
          .then((found) => found.delete())
          .catch(bestEffort(`Deleting snapshot ${snapshot.id}`))
      }
    }
  }
  await sandbox.delete()
}
