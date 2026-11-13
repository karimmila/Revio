import type { ActionRunMode, ActionTarget } from './repo-actions'
import type { ActionRunLocation } from './repo-action-runnables'

export type RepoActionListEntry = {
  id: string
  name: string
  script: string
  shared: boolean
  targets: ActionTarget[]
  /** Where this workspace can run it; empty when it cannot run here. */
  runsIn: ActionRunLocation[]
}

export type RepoActionListResult = {
  worktreeId: string
  location: ActionRunLocation
  runMode: ActionRunMode
  actions: RepoActionListEntry[]
  sharedError: string | null
}

export type RepoActionRunResult = {
  action: { id: string; name: string }
  location: ActionRunLocation
  worktreeId: string
  /** Read its output with `orca terminal read --terminal <handle>`; null when not found in time. */
  terminal: string | null
  alreadyRunning: boolean
}
