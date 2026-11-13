import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Sandbox, Snapshot } from '@vercel/sandbox'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import type { CloudInventory } from '../../shared/cloud/cloud-types'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { isCloudBuildRunning } from './cloud-build'
import { cloudDataRoot, readRepoFile } from './cloud-repo-store'
import { retireSandbox } from './cloud-sandbox-retire'
import { restorePointIds } from './cloud-archive-restore'

function liveSandboxOwners(userDataPath: string): Map<string, string> {
  const owners = new Map<string, string>()
  for (const runtime of listEphemeralVmRuntimes(userDataPath)) {
    if (runtime.recipeId !== VERCEL_CLOUD_RECIPE_ID || runtime.status === 'cleaned') {
      continue
    }
    const userData = runtime.recipeResult?.userData
    const name = userData && typeof userData === 'object' ? userData.sandboxName : undefined
    if (typeof name === 'string') {
      owners.set(name, runtime.workspaceName ?? runtime.id)
    }
  }
  return owners
}

/** Builds' snapshots, and those kept to restore archived workspaces. */
function referencedSnapshots(): Set<string> {
  const referenced = restorePointIds()
  let files: string[] = []
  try {
    files = readdirSync(join(cloudDataRoot(), 'repos'))
  } catch {
    return referenced
  }
  for (const file of files.filter((name) => name.endsWith('.json'))) {
    for (const build of readRepoFile(file.slice(0, -'.json'.length)).builds) {
      if (build.snapshotId) {
        referenced.add(build.snapshotId)
      }
    }
  }
  return referenced
}

/**
 * What the Orca project on Vercel holds, matched against this Mac's records: which workspace owns
 * each sandbox (none means an orphan to delete) and which snapshots a build, an archived
 * workspace or a sleeping sandbox still uses. Every page is read, not just the first.
 */
export async function readCloudInventory(userDataPath: string): Promise<CloudInventory> {
  const scope = await vercelScope()
  const owners = liveSandboxOwners(userDataPath)
  const referenced = referencedSnapshots()
  const sandboxes: CloudInventory['sandboxes'] = []
  for await (const entry of await Sandbox.list({ ...scope, limit: 50 })) {
    // A stopped sandbox wakes from this snapshot: it holds the sleeping workspace's work.
    if (entry.currentSnapshotId) {
      referenced.add(entry.currentSnapshotId)
    }
    const tags = entry.tags ?? {}
    const kind = tags.orca === 'build' ? 'build' : tags.orca === 'workspace' ? 'workspace' : 'other'
    const owner = owners.get(entry.name) ?? null
    const building =
      kind === 'build' && typeof tags.repo === 'string' && isCloudBuildRunning(tags.repo)
    sandboxes.push({
      name: entry.name,
      status: entry.status,
      kind,
      owner,
      orphan: !owner && !building,
      createdAt: entry.createdAt
    })
  }
  const snapshots: CloudInventory['snapshots'] = []
  for await (const snapshot of await Snapshot.list({ ...scope, limit: 50 })) {
    if (snapshot.status === 'deleted') {
      continue
    }
    snapshots.push({
      id: snapshot.id,
      sizeBytes: snapshot.sizeBytes,
      createdAt: snapshot.createdAt,
      automatic: snapshot.creationMethod === 'automatic',
      referenced: referenced.has(snapshot.id)
    })
  }
  return { sandboxes, snapshots }
}

export async function deleteOrphanSandbox(userDataPath: string, name: string): Promise<void> {
  if (liveSandboxOwners(userDataPath).has(name)) {
    throw new Error('That sandbox belongs to a workspace; archive the workspace instead.')
  }
  const scope = await vercelScope()
  await retireSandbox(await Sandbox.get({ ...scope, name }), scope)
}

export async function deleteUnusedSnapshot(snapshotId: string): Promise<void> {
  if (referencedSnapshots().has(snapshotId)) {
    throw new Error('A repository build or an archived workspace still uses that snapshot.')
  }
  const scope = await vercelScope()
  // Checked here too, not only in the listing: the renderer names the snapshot, and a sandbox
  // may have gone to sleep since the list was read.
  for await (const entry of await Sandbox.list({ ...scope, limit: 50 })) {
    if (entry.currentSnapshotId === snapshotId) {
      throw new Error(
        'A sleeping workspace wakes from that snapshot; delete the workspace instead.'
      )
    }
  }
  await (await Snapshot.get({ ...scope, snapshotId })).delete()
}
