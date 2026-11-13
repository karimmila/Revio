import { Snapshot } from '@vercel/sandbox'
import { currentSnapshot } from '../../shared/cloud/cloud-types'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { statusOfCloudError } from './cloud-errors'
import { readRepoFile, saveCloudBuild } from './cloud-repo-store'

/** Stored on a build whose snapshot Vercel no longer has; readiness then asks for a rebuild. */
export const CLOUD_BUILD_EXPIRED = 'Vercel no longer has this build.'

export type CloudBuildCheck = 'ready' | 'missing' | 'expired'

type SnapshotLookup = (snapshotId: string) => Promise<{ status: string; expiresAt?: Date }>

const lookUpOnVercel: SnapshotLookup = async (snapshotId) =>
  Snapshot.get({ ...(await vercelScope()), snapshotId })

function isNotFound(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error)
  return statusOfCloudError(error) === 404 || /not[ _-]?found/i.test(raw)
}

/**
 * One Vercel lookup before Create: is the repository's build snapshot still there? Readiness
 * reads only Orca's own record, and Vercel can expire or delete a snapshot on its own (live,
 * 2026-11-10: "ready", then Create failed with "This repository's cloud build is gone"). A gone
 * snapshot is cleared from the record so readiness and the Create guard offer Rebuild. Any other
 * failure (offline, sign-in) answers "ready" and leaves Create to report it.
 */
export async function checkCloudBuild(
  repoId: string,
  lookUp: SnapshotLookup = lookUpOnVercel,
  now: number = Date.now()
): Promise<CloudBuildCheck> {
  const build = currentSnapshot(readRepoFile(repoId))
  if (!build?.snapshotId) {
    return 'missing'
  }
  let gone: boolean
  try {
    const snapshot = await lookUp(build.snapshotId)
    gone =
      snapshot.status !== 'created' ||
      (snapshot.expiresAt !== undefined && snapshot.expiresAt.getTime() <= now)
  } catch (error) {
    gone = isNotFound(error)
  }
  if (!gone) {
    return 'ready'
  }
  saveCloudBuild(repoId, { ...build, snapshotId: null, error: CLOUD_BUILD_EXPIRED })
  return 'expired'
}
