import type { Automation, AutomationPrecheck } from '../../../../shared/automations-types'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import type { AutomationDraft } from './AutomationEditorDialog'
import {
  isRunnableAutomationSchedule,
  tryParseAutomationRrule
} from '../../../../shared/automation-schedule-parsing'
import { formatTimeInput } from './automation-draft-model'

/** What a saved version restores. The run target is left out: moving a routine to another
 * project or host goes through the editor's move path, not a revert. */
export type AutomationVersionSnapshot = Pick<
  Automation,
  | 'name'
  | 'prompt'
  | 'agentId'
  | 'precheck'
  | 'rrule'
  | 'missedRunGraceMinutes'
  | 'baseBranch'
  | 'reuseSession'
> & { extraAgentArgs: string }

export type AutomationVersion = {
  version: number
  savedAt: number
  snapshot: AutomationVersionSnapshot
}

// Per device: the workspace layout keeps versions on its server, Orca's hosts keep no history.
const STORAGE_KEY = 'orca.automation-versions.v1'
export const MAX_VERSIONS_PER_AUTOMATION = 20
const MAX_AUTOMATIONS = 200

type VersionStore = Record<string, AutomationVersion[]>

export function automationVersionSnapshot(automation: Automation): AutomationVersionSnapshot {
  return {
    name: automation.name,
    prompt: automation.prompt,
    agentId: automation.agentId,
    precheck: automation.precheck,
    rrule: automation.rrule,
    missedRunGraceMinutes: automation.missedRunGraceMinutes,
    baseBranch: automation.baseBranch,
    reuseSession: automation.reuseSession,
    extraAgentArgs: automation.extraAgentArgs ?? ''
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPrecheck(value: unknown): AutomationPrecheck | null | undefined {
  if (value === null) {
    return null
  }
  return isRecord(value) &&
    typeof value.command === 'string' &&
    typeof value.timeoutSeconds === 'number'
    ? { command: value.command, timeoutSeconds: value.timeoutSeconds }
    : undefined
}

function readVersion(value: unknown): AutomationVersion | null {
  if (!isRecord(value) || typeof value.version !== 'number' || typeof value.savedAt !== 'number') {
    return null
  }
  const s = value.snapshot
  if (!isRecord(s) || !isTuiAgent(s.agentId)) {
    return null
  }
  const precheck = readPrecheck(s.precheck)
  if (
    typeof s.name !== 'string' ||
    typeof s.prompt !== 'string' ||
    typeof s.rrule !== 'string' ||
    typeof s.missedRunGraceMinutes !== 'number' ||
    (s.baseBranch !== null && typeof s.baseBranch !== 'string') ||
    typeof s.reuseSession !== 'boolean' ||
    typeof s.extraAgentArgs !== 'string' ||
    precheck === undefined
  ) {
    return null
  }
  return {
    version: value.version,
    savedAt: value.savedAt,
    snapshot: {
      name: s.name,
      prompt: s.prompt,
      agentId: s.agentId,
      precheck,
      rrule: s.rrule,
      missedRunGraceMinutes: s.missedRunGraceMinutes,
      baseBranch: s.baseBranch,
      reuseSession: s.reuseSession,
      extraAgentArgs: s.extraAgentArgs
    }
  }
}

function readStore(): VersionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!isRecord(parsed)) {
      return {}
    }
    const store: VersionStore = {}
    for (const [id, versions] of Object.entries(parsed)) {
      if (Array.isArray(versions)) {
        store[id] = versions.map(readVersion).filter((entry) => entry !== null)
      }
    }
    return store
  } catch {
    return {}
  }
}

function writeStore(store: VersionStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // History is a convenience; a full or blocked storage must not fail the save.
  }
}

function sameSnapshot(a: AutomationVersionSnapshot, b: AutomationVersionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Newest first. */
export function loadAutomationVersions(automationId: string): AutomationVersion[] {
  return [...(readStore()[automationId] ?? [])].sort((a, b) => b.version - a.version)
}

/** Appends the automation's state unless it matches the newest version; keeps the newest 20
 * versions per routine and the 200 most recently saved routines. */
export function recordAutomationVersion(automation: Automation, savedAt: number): void {
  const store = readStore()
  const versions = store[automation.id] ?? []
  const latest = versions.reduce<AutomationVersion | null>(
    (best, entry) => (best && best.version > entry.version ? best : entry),
    null
  )
  const snapshot = automationVersionSnapshot(automation)
  if (latest && sameSnapshot(latest.snapshot, snapshot)) {
    return
  }
  const next = [...versions, { version: (latest?.version ?? 0) + 1, savedAt, snapshot }]
    .sort((a, b) => b.version - a.version)
    .slice(0, MAX_VERSIONS_PER_AUTOMATION)
  store[automation.id] = next
  const newestSave = (id: string): number => Math.max(...store[id].map((entry) => entry.savedAt))
  const kept = Object.keys(store)
    .sort((a, b) => newestSave(b) - newestSave(a))
    .slice(0, MAX_AUTOMATIONS)
  writeStore(Object.fromEntries(kept.map((id) => [id, store[id]])))
}

/** Puts a version's fields into the open editor; the target fields stay as they are. */
export function restoreAutomationVersionDraft(
  current: AutomationDraft,
  version: AutomationVersion
): AutomationDraft {
  const { snapshot } = version
  const schedule = tryParseAutomationRrule(snapshot.rrule)
  const custom = !schedule && isRunnableAutomationSchedule(snapshot.rrule)
  return {
    ...current,
    name: snapshot.name,
    prompt: snapshot.prompt,
    agentId: snapshot.agentId,
    extraAgentArgs: snapshot.extraAgentArgs,
    baseBranch: snapshot.baseBranch ?? '',
    reuseSession: current.workspaceMode === 'existing' && snapshot.reuseSession,
    precheckCommand: snapshot.precheck?.command ?? '',
    precheckTimeoutSeconds: String(snapshot.precheck?.timeoutSeconds ?? 60),
    preset: schedule?.preset ?? (custom ? 'custom' : current.preset),
    time: schedule ? formatTimeInput(schedule.hour, schedule.minute) : current.time,
    dayOfWeek: schedule ? String(schedule.dayOfWeek ?? 1) : current.dayOfWeek,
    customSchedule: custom ? snapshot.rrule : '',
    missedRunGraceMinutes: String(snapshot.missedRunGraceMinutes)
  }
}
