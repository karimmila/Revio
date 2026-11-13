import { VERCEL_CLOUD_RECIPE_ID } from '../../../../../shared/cloud/cloud-recipe'
import { translate } from '@/i18n/i18n'
import type { PendingWorktreeCreation } from './pending-worktree-creation'

export type CloudSetupStepId =
  | 'machine'
  | 'connect'
  | 'checkout'
  | 'runtime'
  | 'project'
  | 'open'
  | 'start-agent'

export type CloudSetupStepState = 'pending' | 'running' | 'done' | 'failed'

export type CloudSetupStep = {
  id: CloudSetupStepId
  state: CloudSetupStepState
  /** Running: time so far. Done: the step's own duration. Null when unknown or not started. */
  elapsedMs: number | null
}

export type CloudSetupEntry = Pick<
  PendingWorktreeCreation,
  'status' | 'phase' | 'startedAt' | 'phaseLog' | 'provisioningLog' | 'request'
> & { error?: string | null }

// Why: these are the `create <phase>: N s` lines written after each create phase (the recipe in
// vercel-workspace-provider.ts, then main's runtime connect and the renderer's project setup, via
// cloudCreateTimingLine); renaming a phase there silently freezes this checklist on its previous step.
const TIMED_PHASES: readonly { id: CloudSetupStepId; phase: string }[] = [
  { id: 'machine', phase: 'sandbox from snapshot' },
  { id: 'connect', phase: 'ssh' },
  { id: 'checkout', phase: 'checkout' },
  { id: 'runtime', phase: 'remote runtime' },
  { id: 'project', phase: 'project' }
]

const TIMING_LINE = /^(?:\[cloud\] )?create (.+): (\d+(?:\.\d+)?) s$/

/** Durations (ms) of the cloud create phases that already finished, read from the recipe log. */
export function parseCloudPhaseDurations(log: string): Map<CloudSetupStepId, number> {
  const durations = new Map<CloudSetupStepId, number>()
  for (const line of log.split('\n')) {
    const match = TIMING_LINE.exec(line.trim())
    const step = match ? TIMED_PHASES.find(({ phase }) => phase === match[1]) : undefined
    if (match && step) {
      durations.set(step.id, Math.round(Number(match[2]) * 1000))
    }
  }
  return durations
}

const STEP_ORDER: readonly CloudSetupStepId[] = [
  'machine',
  'connect',
  'checkout',
  'runtime',
  'project',
  'open'
]

// Why: the timing line for a phase is written only once it finishes, so a failure inside a phase
// leaves the log one step behind (a failed checkout read as "Couldn't start machine"). The error
// text names the phase that broke; it only ever moves the failure later, never earlier.
const ERROR_STEP_HINTS: readonly { id: CloudSetupStepId; pattern: RegExp }[] = [
  { id: 'open', pattern: /\bworkspace create\b/i },
  { id: 'project', pattern: /\bproject\b/i },
  { id: 'runtime', pattern: /\b(pair|pairing|runtime|server)\b/i },
  { id: 'checkout', pattern: /\b(checkout|check out|git|branch|clone|fetch)\b/i },
  { id: 'connect', pattern: /\b(ssh|connect|connection|websocket|host key)\b/i }
]

export function failedStepHint(error: string | null | undefined): CloudSetupStepId | null {
  if (!error) {
    return null
  }
  return ERROR_STEP_HINTS.find(({ pattern }) => pattern.test(error))?.id ?? null
}

function provisioningStartedAt(entry: CloudSetupEntry): number {
  return entry.phaseLog?.find((record) => record.phase === 'provisioning-vm')?.at ?? entry.startedAt
}

function provisioningEndedAt(entry: CloudSetupEntry): number | null {
  const log = entry.phaseLog ?? []
  const start = log.findIndex((record) => record.phase === 'provisioning-vm')
  return start !== -1 && log[start + 1] ? log[start + 1].at : null
}

/**
 * The cloud workspace checklist. The recipe only streams log text, so the Vercel steps advance on
 * its timing lines; other recipes get one machine step. The machine is handed over once the
 * creation leaves the provisioning phase, and "open" covers pairing plus the workspace create.
 */
export function deriveCloudSetupSteps(entry: CloudSetupEntry, now: number): CloudSetupStep[] {
  const isVercel = entry.request.ephemeralVmRecipe?.recipeId === VERCEL_CLOUD_RECIPE_ID
  const handedOver = entry.phase !== 'provisioning-vm'
  const failed = entry.status === 'error'
  const start = provisioningStartedAt(entry)
  const ids: CloudSetupStepId[] = isVercel
    ? ['machine', 'connect', 'checkout', 'runtime', 'project']
    : ['machine']
  const durations: Map<CloudSetupStepId, number | null> = isVercel
    ? parseCloudPhaseDurations(entry.provisioningLog ?? '')
    : new Map()
  if (!isVercel && handedOver) {
    const end = provisioningEndedAt(entry)
    durations.set('machine', end === null ? null : end - start)
  }
  const steps: CloudSetupStep[] = []
  let cursor = start
  let activeFound = false
  const hint = failed && isVercel ? failedStepHint(entry.error) : null
  const reachedBefore = (id: CloudSetupStepId): boolean =>
    hint !== null && STEP_ORDER.indexOf(id) < STEP_ORDER.indexOf(hint)
  for (const id of [...ids, 'open' as const]) {
    const known = durations.has(id) || (id !== 'open' && handedOver) || reachedBefore(id)
    if (known && !activeFound) {
      const ms = durations.get(id) ?? null
      steps.push({ id, state: 'done', elapsedMs: ms })
      cursor += ms ?? 0
      continue
    }
    if (!activeFound) {
      activeFound = true
      steps.push(
        failed
          ? { id, state: 'failed', elapsedMs: null }
          : { id, state: 'running', elapsedMs: Math.max(0, now - cursor) }
      )
      continue
    }
    steps.push({ id, state: 'pending', elapsedMs: null })
  }
  if (entry.request.agent !== null) {
    // The card closes when the workspace opens, before the agent starts, so this row stays pending.
    steps.push({ id: 'start-agent', state: 'pending', elapsedMs: null })
  }
  return steps
}

/** The step a viewer should read as "now": the running or failed one. */
export function currentCloudSetupStep(steps: readonly CloudSetupStep[]): CloudSetupStep | null {
  return steps.find((step) => step.state === 'running' || step.state === 'failed') ?? null
}

/** True when this pending creation should show the cloud setup card instead of the plain loader. */
export function isCloudSetupCreation(
  entry: Pick<PendingWorktreeCreation, 'phase' | 'request'>
): boolean {
  return entry.phase === 'provisioning-vm' || entry.request.ephemeralVmRecipe !== undefined
}

/** Cursor-style tense: "Checking out branch" while running, "Checked out branch" once done. */
export function cloudSetupStepLabel(
  id: CloudSetupStepId,
  state: CloudSetupStepState,
  isVercel: boolean
): string {
  const tense = state === 'done' ? 'done' : state === 'failed' ? 'failed' : 'running'
  return STEP_LABELS[id][tense](isVercel)
}

type Labels = Record<'running' | 'done' | 'failed', (isVercel: boolean) => string>

const STEP_LABELS: Record<CloudSetupStepId, Labels> = {
  machine: {
    running: (isVercel) =>
      isVercel
        ? translate(
            'auto.lib.cloudSetupSteps.machineRunningSnapshot',
            'Starting machine from snapshot'
          )
        : translate('auto.lib.cloudSetupSteps.machineRunning', 'Starting machine'),
    done: (isVercel) =>
      isVercel
        ? translate('auto.lib.cloudSetupSteps.machineDoneSnapshot', 'Started machine from snapshot')
        : translate('auto.lib.cloudSetupSteps.machineDone', 'Started machine'),
    failed: () => translate('auto.lib.cloudSetupSteps.machineFailed', 'Couldn’t start machine')
  },
  connect: {
    running: () => translate('auto.lib.cloudSetupSteps.connectRunning', 'Connecting securely'),
    done: () => translate('auto.lib.cloudSetupSteps.connectDone', 'Connected securely'),
    failed: () => translate('auto.lib.cloudSetupSteps.connectFailed', 'Couldn’t connect')
  },
  checkout: {
    running: () => translate('auto.lib.cloudSetupSteps.checkoutRunning', 'Checking out branch'),
    done: () => translate('auto.lib.cloudSetupSteps.checkoutDone', 'Checked out branch'),
    failed: () => translate('auto.lib.cloudSetupSteps.checkoutFailed', 'Couldn’t check out branch')
  },
  runtime: {
    running: () => translate('auto.lib.cloudSetupSteps.runtimeRunning', 'Starting remote runtime'),
    done: () => translate('auto.lib.cloudSetupSteps.runtimeDone', 'Started remote runtime'),
    failed: () =>
      translate('auto.lib.cloudSetupSteps.runtimeFailed', 'Couldn’t start remote runtime')
  },
  project: {
    running: () => translate('auto.lib.cloudSetupSteps.projectRunning', 'Registering project'),
    done: () => translate('auto.lib.cloudSetupSteps.projectDone', 'Registered project'),
    failed: () => translate('auto.lib.cloudSetupSteps.projectFailed', 'Couldn’t register project')
  },
  open: {
    running: () => translate('auto.lib.cloudSetupSteps.openRunning', 'Opening workspace'),
    done: () => translate('auto.lib.cloudSetupSteps.openDone', 'Opened workspace'),
    failed: () => translate('auto.lib.cloudSetupSteps.openFailed', 'Couldn’t open workspace')
  },
  'start-agent': {
    running: () => translate('auto.lib.cloudSetupSteps.startAgentRunning', 'Starting agent'),
    done: () => translate('auto.lib.cloudSetupSteps.startAgentDone', 'Started agent'),
    failed: () => translate('auto.lib.cloudSetupSteps.startAgentFailed', 'Couldn’t start agent')
  }
}

/** Sidebar subtitle for a cloud creation in progress, e.g. "Checking out branch…". */
export function cloudSetupProgressLabel(entry: CloudSetupEntry, now: number): string {
  const isVercel = entry.request.ephemeralVmRecipe?.recipeId === VERCEL_CLOUD_RECIPE_ID
  const current = currentCloudSetupStep(deriveCloudSetupSteps(entry, now))
  const id = current?.id ?? 'open'
  return translate('auto.lib.cloudSetupSteps.progressLabel', '{{step}}…', {
    step: cloudSetupStepLabel(id, 'running', isVercel)
  })
}

/** Log text for people: drops the internal "[cloud] " line prefix. Secrets are redacted upstream. */
export function cleanCloudSetupLog(log: string): string {
  return log.replace(/^\[cloud\] /gm, '')
}

/**
 * The newest log line, for a muted note under the running step: "Opening workspace" can take half a
 * minute with no step change, and this shows it is still moving. Timing lines are skipped; they
 * restate the checklist.
 */
export function latestCloudSetupLogLine(log: string): string | null {
  const lines = cleanCloudSetupLog(log).split('\n')
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index].trim()
    if (line && !TIMING_LINE.test(line) && !/^create .+: \d/.test(line)) {
      return line
    }
  }
  return null
}
