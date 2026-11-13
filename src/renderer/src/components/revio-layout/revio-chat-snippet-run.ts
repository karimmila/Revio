import React from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { runQuickCommandInNewTab } from '@/lib/run-quick-command-in-new-tab'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { runInRevioDock } from './revio-dock-terminals'
import { isRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import { watchChatSnippetOutput } from './revio-chat-snippet-output'

// The workspace layout offers Run on these fence languages only.
const RUNNABLE_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh'])

/**
 * The shell types the command after it starts, so for a moment the tab has no child process even
 * though the run has not begun. Inside this window the run counts as running.
 */
export const SNIPPET_START_GRACE_MS = 2000
const POLL_MS = 1000
const TITLE_MAX = 32

type SnippetRun = { readonly tabId: string; readonly startedAt: number }

export function isRunnableSnippetLanguage(language: string | undefined): boolean {
  return language !== undefined && RUNNABLE_LANGUAGES.has(language.trim().toLowerCase())
}

/** One tab per snippet: the title is the command's first line, so a rerun replaces its own tab. */
export function snippetTabTitle(command: string): string {
  const firstLine = command.trim().split('\n').at(0)?.trim() ?? ''
  return firstLine.length > TITLE_MAX ? `${firstLine.slice(0, TITLE_MAX - 1)}…` : firstLine
}

export function snippetRunKey(worktreeId: string, command: string): string {
  return `${worktreeId}\n${command.trim()}`
}

let runs: Readonly<Record<string, SnippetRun>> = {}
const stopWatchingOutput = new Map<string, () => void>()
const listeners = new Set<() => void>()

function setRuns(next: Readonly<Record<string, SnippetRun>>): void {
  runs = next
  for (const listener of listeners) {
    listener()
  }
}

function forgetRun(key: string): void {
  stopWatchingOutput.get(key)?.()
  stopWatchingOutput.delete(key)
  if (!(key in runs)) {
    return
  }
  const next = { ...runs }
  delete next[key]
  setRuns(next)
}

export function isCloudWorkspace(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  return repo ? isCloudRepo(repo, cloudEnvironmentIdsNow()) : false
}

/**
 * Runs a chat code block in the workspace: the dock for a workspace on this Mac, a tab on the
 * workspace's own host otherwise. A local run's output also shows under the code block.
 */
export function runChatSnippet(worktreeId: string, command: string): boolean {
  const trimmed = command.trim()
  const title = snippetTabTitle(trimmed)
  let tabId: string | null = null
  try {
    tabId =
      runInRevioDock(worktreeId, title, trimmed) ??
      runQuickCommandInNewTab({
        command: { id: 'revio:snippet', label: title, command: trimmed, appendEnter: true },
        worktreeId
      })?.tabId ??
      null
  } catch {
    tabId = null
  }
  if (!tabId) {
    toast.error(
      translate('auto.components.revioLayout.snippetRunFailed', 'Failed to run code snippet')
    )
    return false
  }
  const key = snippetRunKey(worktreeId, trimmed)
  stopWatchingOutput.get(key)?.()
  stopWatchingOutput.set(key, watchChatSnippetOutput(key, tabId))
  setRuns({ ...runs, [key]: { tabId, startedAt: Date.now() } })
  return true
}

function findTab(tabId: string): boolean {
  const state = useAppStore.getState()
  return Object.values(state.tabsByWorktree).some((tabs) => tabs.some((tab) => tab.id === tabId))
}

function tabPtyIds(tabId: string): string[] {
  const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
  return Object.values(layout?.ptyIdsByLeafId ?? {}).filter((id): id is string => !!id)
}

/** "Stop command": ⌃C to the snippet's shell, or close a tab with no local process. */
export function stopChatSnippet(key: string): void {
  const run = runs[key]
  if (!run) {
    return
  }
  const local = tabPtyIds(run.tabId).filter((id) => !isRemoteRuntimePtyId(id))
  if (local.length > 0) {
    local.forEach((id) => window.api.pty.write(id, '\x03', 'driving'))
  } else if (findTab(run.tabId)) {
    useAppStore.getState().closeTab(run.tabId)
  }
  forgetRun(key)
}

/**
 * True while the snippet still runs: its tab is open and its shell has a child process. A remote
 * shell cannot be asked, so its run lasts until the tab closes or the user stops it.
 */
export async function isSnippetStillRunning(run: SnippetRun, now: number): Promise<boolean> {
  if (!findTab(run.tabId)) {
    return false
  }
  if (now - run.startedAt < SNIPPET_START_GRACE_MS) {
    return true
  }
  const ptyIds = tabPtyIds(run.tabId)
  if (ptyIds.length === 0 || ptyIds.some(isRemoteRuntimePtyId)) {
    return true
  }
  const busy = await Promise.all(
    ptyIds.map((id) => window.api.pty.hasChildProcesses(id).catch(() => false))
  )
  return busy.includes(true)
}

export function useChatSnippetRunning(key: string | null): boolean {
  const run = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (key === null ? undefined : runs[key])
  )
  React.useEffect(() => {
    if (!run || key === null) {
      return
    }
    let cancelled = false
    const timer = window.setInterval(() => {
      void isSnippetStillRunning(run, Date.now()).then((running) => {
        if (!cancelled && !running && runs[key] === run) {
          forgetRun(key)
        }
      })
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [key, run])
  return run !== undefined
}

export function resetChatSnippetRunsForTest(): void {
  stopWatchingOutput.forEach((stop) => stop())
  stopWatchingOutput.clear()
  setRuns({})
}

export function chatSnippetRunForTest(key: string): SnippetRun | undefined {
  return runs[key]
}
