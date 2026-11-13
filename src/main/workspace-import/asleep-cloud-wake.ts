import type {
  AsleepCloudWakeChanges,
  AsleepCloudWorkspace
} from '../../shared/asleep-cloud-workspace-types'
import { prepareCloudRestore } from '../cloud/cloud-archive-restore'
import {
  clearAsleepCloudPayloadOutcome,
  readAsleepCloudPayloadOutcome
} from './asleep-cloud-payload'
import {
  asleepCloudPayloadDir,
  findAsleepCloudWorkspace,
  removeAsleepCloudWorkspace
} from './asleep-cloud-store'

/**
 * Marks the next cloud create of the workspace's repository and branch as its wake: the create
 * starts from the build, checks out the workspace's commit and applies what it kept.
 */
export function prepareAsleepCloudWake(userDataDir: string, id: string): AsleepCloudWorkspace {
  const record = findAsleepCloudWorkspace(userDataDir, id)
  if (!record) {
    throw new Error('This imported workspace is no longer waiting to be opened.')
  }
  clearAsleepCloudPayloadOutcome(asleepCloudPayloadDir(userDataDir, id))
  prepareCloudRestore({
    repoId: record.repoId,
    branch: record.branch,
    snapshotId: null,
    commit: record.commit,
    importPayloadDir: asleepCloudPayloadDir(userDataDir, id)
  })
  return record
}

/**
 * Called once the woken workspace is listed. The record and the Mac's copy go only when the
 * sandbox took everything; otherwise both stay and the row comes back, so nothing is lost.
 */
export function finishAsleepCloudWake(
  userDataDir: string,
  id: string
): AsleepCloudWakeChanges | null {
  const changes = readAsleepCloudPayloadOutcome(asleepCloudPayloadDir(userDataDir, id))
  if (changes === null) {
    return null
  }
  removeAsleepCloudWorkspace(userDataDir, id)
  return changes
}
