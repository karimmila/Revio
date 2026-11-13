import {
  WORKSPACE_SETUP_STEP_IDS,
  type WorkspaceSetupProgress,
  type WorkspaceSetupStepId
} from '../../../../../shared/workspace-setup'

export type SetupStatus = 'checking' | 'connected' | 'not-connected'
export type ConnectableStepId = Exclude<WorkspaceSetupStepId, 'finish'>
export type SetupStatuses = Record<ConnectableStepId, SetupStatus>
export type StepMark = 'done' | 'later' | 'open'
export type SetupLocation = 'local' | 'cloud'

const LAST_INDEX = WORKSPACE_SETUP_STEP_IDS.length - 1

export function stepIdAt(index: number): WorkspaceSetupStepId {
  return WORKSPACE_SETUP_STEP_IDS[Math.min(Math.max(index, 0), LAST_INDEX)]
}

/** A step connected now is done, whatever was saved; a skipped one stays "later" until then. */
export function stepMark(
  id: WorkspaceSetupStepId,
  statuses: SetupStatuses,
  progress: WorkspaceSetupProgress
): StepMark {
  if (id === 'finish') {
    return 'open'
  }
  if (statuses[id] === 'connected') {
    return 'done'
  }
  return progress.skipped.includes(id) ? 'later' : 'open'
}

/** The next step in `direction`, or `index` itself when there is none that way. */
export function neighbourIndex(index: number, direction: 1 | -1): number {
  return Math.min(Math.max(index + direction, 0), LAST_INDEX)
}

/** From `index` forward, past steps that are already connected; never past the final screen. */
export function firstOpenIndexFrom(index: number, statuses: SetupStatuses): number {
  let current = Math.min(Math.max(index, 0), LAST_INDEX)
  while (current < LAST_INDEX) {
    const id = stepIdAt(current)
    if (id === 'finish' || statuses[id] !== 'connected') {
      return current
    }
    current += 1
  }
  return LAST_INDEX
}

/** Where a reopened flow starts: after the saved step, skipping what is already connected. */
export function resumeStepIndex(progress: WorkspaceSetupProgress, statuses: SetupStatuses): number {
  return firstOpenIndexFrom(progress.lastCompletedStep + 1, statuses)
}

/**
 * Help > Onboarding saves the empty record before it shows the flow. A first run has no record
 * yet, and one resumed after a restart is already past its first step.
 */
export function isReopenedSetup(progress: WorkspaceSetupProgress | undefined): boolean {
  return progress !== undefined && progress.lastCompletedStep === -1
}

export function statusesSettled(statuses: SetupStatuses): boolean {
  return Object.values(statuses).every((status) => status !== 'checking')
}

/** Continue clears a step's "later" mark; Set up later adds it. Progress never moves back. */
export function recordStep(
  progress: WorkspaceSetupProgress,
  index: number,
  outcome: 'continue' | 'later'
): WorkspaceSetupProgress {
  const id = stepIdAt(index)
  const others = progress.skipped.filter((skipped) => skipped !== id)
  return {
    lastCompletedStep: Math.min(Math.max(progress.lastCompletedStep, index), LAST_INDEX),
    skipped: outcome === 'later' && id !== 'finish' ? [...others, id] : others
  }
}

/**
 * Steps for the final screen's summary, in display order. Every step is listed for everyone: the
 * GitHub sign-in also serves pull requests and checks in workspaces on this Mac, not only the cloud.
 */
export function setupSummary(
  statuses: SetupStatuses,
  progress: WorkspaceSetupProgress
): { id: ConnectableStepId; mark: StepMark }[] {
  return WORKSPACE_SETUP_STEP_IDS.filter((id): id is ConnectableStepId => id !== 'finish').map(
    (id) => ({ id, mark: stepMark(id, statuses, progress) })
  )
}

export const WORKSPACE_SETUP_LAST_INDEX = LAST_INDEX
