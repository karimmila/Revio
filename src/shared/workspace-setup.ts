/**
 * Workspace Layout first run: its steps in display order. The ids are persisted in the onboarding
 * state, so renaming one orphans saved progress.
 */
export const WORKSPACE_SETUP_STEP_IDS = ['agent', 'cloud', 'project', 'github', 'finish'] as const

export type WorkspaceSetupStepId = (typeof WORKSPACE_SETUP_STEP_IDS)[number]

export type WorkspaceSetupProgress = {
  /** Index of the furthest step left with Continue or Set up later; -1 before the first. */
  lastCompletedStep: number
  /** Steps left with Set up later and not connected since. */
  skipped: WorkspaceSetupStepId[]
}

export const EMPTY_WORKSPACE_SETUP_PROGRESS: WorkspaceSetupProgress = {
  lastCompletedStep: -1,
  skipped: []
}

function isStepId(value: unknown): value is WorkspaceSetupStepId {
  return WORKSPACE_SETUP_STEP_IDS.some((id) => id === value)
}

/** Untyped IPC or disk input to a valid progress record; null when it is not one. */
export function sanitizeWorkspaceSetupProgress(value: unknown): WorkspaceSetupProgress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const step = 'lastCompletedStep' in value ? value.lastCompletedStep : undefined
  if (
    typeof step !== 'number' ||
    !Number.isInteger(step) ||
    step < -1 ||
    step >= WORKSPACE_SETUP_STEP_IDS.length
  ) {
    return null
  }
  const rawSkipped = 'skipped' in value ? value.skipped : undefined
  const skipped = Array.isArray(rawSkipped) ? [...new Set(rawSkipped.filter(isStepId))] : []
  return { lastCompletedStep: step, skipped }
}
