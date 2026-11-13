import { Sandbox, Snapshot } from '@vercel/sandbox'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { forgetRestorePoint, recordRestorePoint, restorePointIds } from './cloud-restore-points'
import { listAllSnapshots, retireSandbox } from './cloud-sandbox-retire'
import { waitForSandboxToSettle } from './cloud-sandbox-settle'
import { humanCloudError, isSandboxGone } from './cloud-errors'
import { bestEffort, cloudInfo } from './cloud-log'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'

export { recordRestorePoint, restorePointIds }

/**
 * Archiving a cloud workspace whose sandbox is asleep must not wake it. The sandbox's own stop
 * snapshot already holds everything the workspace had (Vercel takes one each time a persistent
 * sandbox stops), so archive keeps that one snapshot as the restore point, deletes the sandbox
 * and its other snapshots, and Unarchive starts a new sandbox from it. A restore point lives as
 * long as its archive record; Vercel still expires it on its own schedule, and Unarchive then
 * falls back to the repository's build plus the archived branch.
 */

type SnapshotSummary = {
  id: string
  status: 'failed' | 'created' | 'deleted'
  createdAt: number
}

/** The sandbox's resume snapshot when usable, else its newest created one. */
export function pickRestoreSnapshot(
  currentSnapshotId: string | undefined,
  snapshots: readonly SnapshotSummary[]
): string | null {
  const created = snapshots.filter((snapshot) => snapshot.status === 'created')
  if (currentSnapshotId && created.some((snapshot) => snapshot.id === currentSnapshotId)) {
    return currentSnapshotId
  }
  const newest = [...created].sort((a, b) => b.createdAt - a.createdAt)[0]
  return newest?.id ?? null
}

/**
 * Deletes a workspace's sandbox and returns the snapshot kept to restore it (null only when the
 * sandbox is already gone, or was asleep with no snapshot left, so nothing more can be lost).
 * One still stopping is waited for (its stop snapshot is being written). One still running is
 * stopped first so Vercel writes a stop snapshot; when that leaves no snapshot the sandbox is
 * kept and this throws. The window normally puts a running workspace to sleep itself first,
 * which also ends its agents and terminals cleanly; the stop here is the backstop.
 */
export async function retireCloudSandboxForArchive(
  userDataPath: string,
  runtimeId: string,
  settle: Parameters<typeof waitForSandboxToSettle>[2] = {}
): Promise<{ restoreSnapshotId: string | null }> {
  const runtime = listEphemeralVmRuntimes(userDataPath).find((entry) => entry.id === runtimeId)
  if (!runtime || runtime.recipeId !== VERCEL_CLOUD_RECIPE_ID) {
    throw new Error('This is not a cloud workspace.')
  }
  const userData = runtime.recipeResult?.userData
  const sandboxName =
    userData && typeof userData === 'object' && typeof userData.sandboxName === 'string'
      ? userData.sandboxName
      : null
  if (!sandboxName) {
    return { restoreSnapshotId: null }
  }
  const scope = await vercelScope()
  let sandbox: Sandbox
  try {
    sandbox = await Sandbox.get({ ...scope, name: sandboxName })
  } catch (error) {
    if (isSandboxGone(error)) {
      return { restoreSnapshotId: null }
    }
    throw error
  }
  sandbox = await waitForSandboxToSettle(sandbox, scope, settle)
  const stoppedHere = sandbox.status === 'running' || sandbox.status === 'pending'
  if (stoppedHere) {
    cloudInfo(`stopping ${sandboxName} so its stop snapshot holds its work`)
    await sandbox.stop()
    sandbox = await waitForSandboxToSettle(
      await Sandbox.get({ ...scope, name: sandboxName }),
      scope,
      settle
    )
    if (sandbox.status === 'running' || sandbox.status === 'pending') {
      throw new Error('This cloud workspace could not be put to sleep, so it was kept.')
    }
  }
  const restoreSnapshotId = pickRestoreSnapshot(
    sandbox.currentSnapshotId,
    await listAllSnapshots(sandbox)
  )
  if (!restoreSnapshotId && stoppedHere) {
    throw new Error('Vercel kept no snapshot of this cloud workspace, so it was kept.')
  }
  if (restoreSnapshotId) {
    // Before the delete: a crash in between leaves a recorded snapshot, never an unlisted one.
    recordRestorePoint(restoreSnapshotId)
  }
  await retireSandbox(
    sandbox,
    scope,
    restoreSnapshotId ? { keepSnapshotId: restoreSnapshotId } : {}
  )
  cloudInfo(`archived ${sandboxName}; restore point ${restoreSnapshotId ?? 'none'}`)
  return { restoreSnapshotId }
}

/** Deletes a restore point once its archive record is gone (unarchived or dropped). */
export async function releaseRestorePoint(snapshotId: string): Promise<void> {
  // Only a snapshot this Mac kept: a record naming any other id deletes nothing.
  if (!restorePointIds().has(snapshotId)) {
    return
  }
  forgetRestorePoint(snapshotId)
  const scope = await vercelScope()
  await Snapshot.get({ ...scope, snapshotId })
    .then((snapshot) => snapshot.delete())
    .catch(bestEffort(`Deleting restore point ${snapshotId}`))
}

export type CloudRestore = {
  snapshotId: string | null
  commit: string
  /** An imported workspace's uncommitted work and chats, applied after the checkout. */
  importPayloadDir?: string
}

const PENDING_RESTORE_MS = 10 * 60_000
const pendingRestores = new Map<string, CloudRestore & { expiresAt: number }>()

function restoreKey(repoId: string, branch: string): string {
  return `${repoId}\0${branch}`
}

/**
 * Unarchive marks the next cloud create of this repository and branch as a restore; the create
 * consumes the mark. Only a snapshot this Mac kept as a restore point can be named.
 */
export function prepareCloudRestore(args: {
  repoId: string
  branch: string
  /** Null when Vercel kept no snapshot: the create then starts from the build at the commit. */
  snapshotId: string | null
  commit: string
  importPayloadDir?: string
}): void {
  if (args.snapshotId !== null && !restorePointIds().has(args.snapshotId)) {
    throw new Error('That snapshot is not an archived workspace’s restore point.')
  }
  pendingRestores.set(restoreKey(args.repoId, args.branch), {
    snapshotId: args.snapshotId,
    commit: args.commit,
    ...(args.importPayloadDir ? { importPayloadDir: args.importPayloadDir } : {}),
    expiresAt: Date.now() + PENDING_RESTORE_MS
  })
}

export function hasPendingCloudRestore(repoId: string, branch: string | undefined): boolean {
  const pending = branch ? pendingRestores.get(restoreKey(repoId, branch)) : undefined
  return pending !== undefined && pending.expiresAt >= Date.now()
}

export function takeCloudRestore(repoId: string, branch: string | undefined): CloudRestore | null {
  if (!branch) {
    return null
  }
  const key = restoreKey(repoId, branch)
  const pending = pendingRestores.get(key)
  pendingRestores.delete(key)
  if (!pending || pending.expiresAt < Date.now()) {
    return null
  }
  return {
    snapshotId: pending.snapshotId,
    commit: pending.commit,
    ...(pending.importPayloadDir ? { importPayloadDir: pending.importPayloadDir } : {})
  }
}

/**
 * An unarchived workspace starts from its archived sandbox's snapshot, which already holds its
 * branch and uncommitted work. Null when there is none or Vercel expired it: the caller then
 * starts from the build.
 */
export async function sandboxFromRestorePoint(
  restore: CloudRestore,
  createFrom: (snapshotId: string) => Promise<Sandbox>,
  log: (text: string) => void
): Promise<Sandbox | null> {
  if (!restore.snapshotId) {
    return null
  }
  return createFrom(restore.snapshotId).catch((error: unknown) => {
    log(
      `The archived sandbox's snapshot is gone (${humanCloudError(error, 'snapshot')}); starting from the build\n`
    )
    return null
  })
}

/**
 * The checkout of a new workspace: `fresh` unless it is an unarchive. From its snapshot the checkout is the archived one,
 * uncommitted work included, so it is left alone. From the build: the archived commit when
 * GitHub has it, else the pushed branch, else `fresh` (a new branch from the base).
 */
export function restoreCheckoutCommand(
  restore: CloudRestore | null,
  fromSnapshot: boolean,
  branch: string | undefined,
  fresh: string
): string {
  if (fromSnapshot) {
    return ':'
  }
  if (!restore || !branch) {
    return fresh
  }
  const quotedBranch = quotePosixShell(branch)
  const commit = quotePosixShell(restore.commit)
  const fetch = 'GIT_TERMINAL_PROMPT=0 git fetch --quiet origin'
  return [
    // An imported workspace's bundle may already have brought a commit GitHub lacks.
    `if git cat-file -e ${quotePosixShell(`${restore.commit}^{commit}`)} 2>/dev/null || ${fetch} ${commit} 2>/dev/null; then git checkout -q -f -B ${quotedBranch} ${commit};`,
    `elif ${fetch} ${quotePosixShell(`refs/heads/${branch}`)} 2>/dev/null; then git checkout -q -f -B ${quotedBranch} FETCH_HEAD;`,
    `else ${fresh}; fi`
  ].join(' ')
}

/** What the runtime record keeps so an asleep workspace can still be archived by branch. */
export function workspaceFacts(
  branch: string | undefined,
  startCommit: string | undefined
): { branch?: string; startCommit?: string } {
  return { ...(branch ? { branch } : {}), ...(startCommit ? { startCommit } : {}) }
}

/** The new workspace's sandbox: from the restore point when armed and still there, else the build. */
export async function startWorkspaceSandbox(
  createFrom: (snapshotId: string) => Promise<Sandbox>,
  buildSnapshotId: string,
  restore: CloudRestore | null,
  log: (text: string) => void
): Promise<{ sandbox: Sandbox; restored: boolean }> {
  const restored = restore ? await sandboxFromRestorePoint(restore, createFrom, log) : null
  if (restored) {
    return { sandbox: restored, restored: true }
  }
  const sandbox = await createFrom(buildSnapshotId).catch((error: unknown) => {
    throw new Error(humanCloudError(error, 'snapshot'))
  })
  return { sandbox, restored: false }
}
