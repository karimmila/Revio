import React from 'react'
import { z } from 'zod'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { runQuickCommandInNewTab } from '@/lib/run-quick-command-in-new-tab'
import { SOURCE_CLOUD_SCRIPT_ENV } from '../../../shared/cloud/cloud-script-env-file'
import { runInRevioDock } from '@/components/revio-layout/revio-dock-terminals'
import { translate } from '@/i18n/i18n'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { cloudEnvironmentIdsNow, isCloudMirrorPath } from '@/lib/cloud-workspaces'
import type { RepoAction } from '../../../shared/actions/repo-actions'
import type { ActionContext } from '../../../shared/actions/repo-action-runnables'
import { REPO_ACTION_EXIT_MARKER } from '../../../shared/actions/repo-action-agent-bridge'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../shared/execution-host'
import { watchRepoActionExit } from './repo-action-exit-watch'

export type { ActionContext }

export async function resolveActionContext(worktreeId: string): Promise<ActionContext | null> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!worktree || !repo) {
    return null
  }
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  if (host?.kind === 'runtime' && cloudEnvironmentIdsNow().has(host.environmentId)) {
    const runtime = (await window.api.ephemeralVm.listRuntimes()).find(
      (entry) => entry.runtimeEnvironmentId === host.environmentId && entry.status !== 'cleaned'
    )
    if (!runtime?.repoId) {
      return null
    }
    const mirror = await window.api.cloud?.mirrorInfo(host.environmentId).catch(() => null)
    return {
      kind: 'cloud',
      sourceRepoId: runtime.repoId,
      worktreeId,
      mirrorWorktreeId:
        mirror?.repoId && mirror.mirrorPath ? `${mirror.repoId}::${mirror.mirrorPath}` : null
    }
  }
  return {
    kind: isCloudMirrorPath(worktree.path) ? 'mirror' : 'local',
    sourceRepoId: repo.id,
    worktreeId,
    mirrorWorktreeId: null
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// The tab each action last started in, per workspace: ⌘R stops it while it is still open.
const runTabs = new Map<string, string>()
// How each action's last run ended, while its tab is still open to show the output.
const runExits = new Map<string, { tabId: string; code: number }>()
const exitWatches = new Map<string, () => void>()
const runListeners = new Set<() => void>()
let runRevision = 0

function notifyRuns(): void {
  runRevision += 1
  for (const listener of runListeners) {
    listener()
  }
}

/** Re-renders when a run starts, stops or exits; tab closes come from the store. */
export function useRepoActionRuns(): number {
  return React.useSyncExternalStore(
    (listener) => {
      runListeners.add(listener)
      return () => runListeners.delete(listener)
    },
    () => runRevision,
    () => runRevision
  )
}

function runKey(actionId: string, worktreeId: string): string {
  return `${worktreeId}\u0000${actionId}`
}

/**
 * `run_mode = "nonconcurrent"`: starting a run stops the runs of every other workspace
 * of the same repository (they share a port, database or Docker stack). Returns how many stopped.
 */
export function stopRunsInOtherWorkspaces(
  worktreeId: string,
  repoWorktreeIds: readonly string[]
): number {
  const others = new Set(repoWorktreeIds.filter((id) => id !== worktreeId))
  let stopped = 0
  for (const key of runTabs.keys()) {
    const [owner = '', actionId = ''] = key.split('\u0000')
    if (others.has(owner) && stopRepoAction(actionId, owner)) {
      stopped += 1
    }
  }
  return stopped
}

/** The open tab an action is running in for this workspace, if any. */
export function runningRepoActionTab(actionId: string, worktreeId: string): string | null {
  const tabId = runTabs.get(runKey(actionId, worktreeId))
  const tabs = useAppStore.getState().tabsByWorktree
  // A workspace-layout run lives in the dock (Orca's floating terminal workspace).
  const open = tabId
    ? [...(tabs[worktreeId] ?? []), ...(tabs[FLOATING_TERMINAL_WORKTREE_ID] ?? [])].some(
        (tab) => tab.id === tabId
      )
    : false
  return open && tabId ? tabId : null
}

/** ⌘R stop: closing the action's tab ends its process. */
export function stopRepoAction(actionId: string, worktreeId: string): boolean {
  const tabId = runningRepoActionTab(actionId, worktreeId)
  if (!tabId) {
    return false
  }
  useAppStore.getState().closeTab(tabId)
  forgetRun(runKey(actionId, worktreeId))
  notifyRuns()
  return true
}

function forgetRun(key: string): void {
  exitWatches.get(key)?.()
  exitWatches.delete(key)
  runTabs.delete(key)
  runExits.delete(key)
}

/** The run's tab from here on: its exit line ends the run, as closing the tab does. */
function trackRun(key: string, tabId: string, actionName: string): void {
  forgetRun(key)
  runTabs.set(key, tabId)
  exitWatches.set(
    key,
    watchRepoActionExit(tabId, actionName, (code) => {
      exitWatches.delete(key)
      if (runTabs.get(key) === tabId) {
        runTabs.delete(key)
        runExits.set(key, { tabId, code })
        notifyRuns()
      }
    })
  )
  notifyRuns()
}

/** The exit code of the action's last run here, while its tab still shows the output. */
export function repoActionExitCode(actionId: string, worktreeId: string): number | null {
  const exit = runExits.get(runKey(actionId, worktreeId))
  const tabs = useAppStore.getState().tabsByWorktree
  const open = exit
    ? [...(tabs[worktreeId] ?? []), ...(tabs[FLOATING_TERMINAL_WORKTREE_ID] ?? [])].some(
        (tab) => tab.id === exit.tabId
      )
    : false
  return open && exit ? exit.code : null
}

/** `export NAME='value';` for each variable, single-quoted for any shell value. */
export function scriptEnvExports(env: Record<string, string>): string {
  return Object.entries(env)
    .filter(([name]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    .map(([name, value]) => `export ${name}='${value.replace(/'/g, `'\\''`)}';`)
    .join(' ')
}

/**
 * Runs an action in a new terminal tab of the workspace it targets, so it runs on that
 * workspace's host (the sandbox for a cloud workspace, this Mac otherwise) with its variables.
 * The script travels base64-encoded on one line: terminals send a typed command line by line, and
 * a multi-line script (if/then, heredocs) must reach bash whole. bash reads it from a pipe, not
 * `-c`, so its text is on no command line and `pkill -f <pattern>` in a script cannot kill itself.
 * The run ends with a dim `■ <name> exited <code>` line, which the Run button and
 * `orca action run --wait` read to tell a finished script from the shell that stays open.
 */
export function runRepoAction(
  action: RepoAction,
  worktreeId: string,
  env: Record<string, string> = {}
): boolean {
  const name = action.name.replace(/'/g, `'\\''`)
  // clear wipes the long encoded line the terminal echoed; the leading space keeps it out of history.
  const exports = scriptEnvExports(env)
  // The subshell traps ⌃C: zsh drops the rest of an interrupted line, and the exit line with it
  // (the script itself still gets the signal, as a trap with a handler is not inherited).
  const command = ` ${exports ? `${exports} ` : ''}(trap : INT; clear; printf '\\033[2m▶ %s\\033[0m\\n' '${name}'; bash -l <(echo ${toBase64(`${SOURCE_CLOUD_SCRIPT_ENV}\n${action.script}`)} | base64 --decode); printf '\\033[2m${REPO_ACTION_EXIT_MARKER} %s exited %s\\033[0m\\n' '${name}' "$?")`
  const key = runKey(action.id, worktreeId)
  const docked = runInRevioDock(
    worktreeId,
    translate('auto.lib.repoActionRun.runTab', 'Run'),
    command
  )
  if (docked) {
    trackRun(key, docked, action.name)
    return true
  }
  const result = runQuickCommandInNewTab({
    command: { id: `action:${action.id}`, label: action.name, command, appendEnter: true },
    worktreeId
  })
  if (result) {
    trackRun(key, result.tabId, action.name)
  }
  return result !== null
}

const LAST_RUN_KEY = 'orca.revioLastAction'
const LastRunSchema = z.record(z.string(), z.string())

function readLastRuns(): Record<string, string> {
  try {
    const parsed = LastRunSchema.safeParse(
      JSON.parse(window.localStorage.getItem(LAST_RUN_KEY) ?? '{}')
    )
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function lastRunActionId(sourceRepoId: string): string | null {
  return readLastRuns()[sourceRepoId] ?? null
}

export function rememberRunAction(sourceRepoId: string, actionId: string): void {
  try {
    window.localStorage.setItem(
      LAST_RUN_KEY,
      JSON.stringify({ ...readLastRuns(), [sourceRepoId]: actionId })
    )
  } catch {
    // The last run is a convenience; without storage ⌘R runs the first action.
  }
}

/** Whether any repo action still runs in this workspace ("· Running" in the title). */
export function worktreeHasRunningAction(worktreeId: string): boolean {
  const prefix = `${worktreeId}\u0000`
  for (const key of runTabs.keys()) {
    if (key.startsWith(prefix) && runningRepoActionTab(key.slice(prefix.length), worktreeId)) {
      return true
    }
  }
  return false
}
