import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { createNonSecureContextUuid } from '../../../../shared/non-secure-context-uuid'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { translate } from '@/i18n/i18n'
import { isRemoteWorkspace } from './revio-workspace-host'
import {
  isInteractiveDockTab,
  markDockTabInteractive,
  markDockTabLive,
  readLiveTabs
} from './revio-dock-session-tabs'
import {
  cloudEnvironmentIdOfRepo,
  dockTabStartup,
  withCleanScreen,
  prepareCloudDockForWorktree
} from './revio-cloud-dock'

/**
 * The dock reuses Orca's single floating terminal workspace, which has no notion of an owning
 * workspace. This registry records which workspace each dock terminal belongs to, so the dock
 * shows and opens only the active workspace's terminals, as the per-workspace panel does.
 * It lives in localStorage because floating tabs survive restarts with their ids.
 */
const STORAGE_KEY = 'orca.revioDockTerminals'

type Owners = Readonly<Record<string, string>>

function readOwners(): Owners {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    const owners: Record<string, string> = {}
    for (const [tabId, worktreeId] of Object.entries(parsed)) {
      if (typeof worktreeId === 'string') {
        owners[tabId] = worktreeId
      }
    }
    return owners
  } catch {
    return {}
  }
}

let owners: Owners = readOwners()
const listeners = new Set<() => void>()

function setOwners(next: Owners): void {
  owners = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage can be refused; ownership still holds for this session.
  }
  for (const listener of listeners) {
    listener()
  }
}

export function useDockTerminalOwners(): Owners {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => owners
  )
}

/** Every dock tab's workspace, by tab id. */
export function dockTabOwners(): Owners {
  return owners
}

/** The workspace a dock tab belongs to, if any. */
export function dockTabOwner(tabId: string): string | null {
  return owners[tabId] ?? null
}

/** True when a dock tab should show for the active workspace. */
export function isDockTabForWorkspace(
  tabId: string,
  activeWorktreeId: string | null,
  current: Owners = owners
): boolean {
  return activeWorktreeId !== null && current[tabId] === activeWorktreeId
}

/** The lowest "Terminal N" the workspace's live dock terminals do not already use. */
function nextTerminalNumber(
  state: ReturnType<typeof useAppStore.getState>,
  worktreeId: string
): number {
  const used = new Set<number>()
  for (const tab of state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []) {
    const match = owners[tab.id] === worktreeId ? /(\d+)\s*$/.exec(tab.customTitle ?? '') : null
    if (match) {
      used.add(Number(match[1]))
    }
  }
  let number = 1
  while (used.has(number)) {
    number += 1
  }
  return number
}

/** Opens a dock terminal in the active workspace's folder: its tab id, or the workspace's id for
 * a terminal opened as a tab on a remote host. */
export function createDockTerminalForActiveWorkspace(
  groupId?: string,
  shellOverride?: string
): string | null {
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  const worktree = worktreeId
    ? findWorktreeById(selectWorktreesByRepo(state), worktreeId)
    : undefined
  if (!worktreeId || !worktree) {
    return null
  }
  if (isRemoteWorkspace(worktreeId)) {
    return createRemoteDockTerminal(worktreeId, groupId)
  }
  const tabId = createNonSecureContextUuid()
  const number = nextTerminalNumber(state, worktreeId)
  setOwners({ ...owners, [tabId]: worktreeId })
  state.createTab(FLOATING_TERMINAL_WORKTREE_ID, groupId, shellOverride, {
    id: tabId,
    startupCwd: worktree.path
  })
  // The workspace layout names a workspace's terminals by position rather than by shell title.
  state.setTabCustomTitle(
    tabId,
    translate('auto.components.revioLayout.terminalNumber', 'Terminal {{value0}}', {
      value0: number
    })
  )
  focusTerminalTabSurface(tabId)
  return tabId
}

/**
 * The workspace layout opens a cloud workspace's "+" terminal in the bottom panel: a dock tab
 * running the workspace's ssh line into an interactive shell in its checkout. The ssh line is read
 * from main first; another remote host, or a sandbox that is not running, gets a tab on its own
 * host.
 */
function createRemoteDockTerminal(worktreeId: string, groupId?: string): string {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!worktree || !cloudEnvironmentIdOfRepo(repo ?? undefined)) {
    openTerminalOnWorkspaceHost(worktreeId)
    return worktreeId
  }
  void prepareCloudDockForWorktree(worktreeId).then((ready) => {
    const startup = ready
      ? withCleanScreen(dockTabStartup(worktree, repo ?? undefined, true, 'true', undefined))
      : null
    if (!startup) {
      openTerminalOnWorkspaceHost(worktreeId)
      return
    }
    const current = useAppStore.getState()
    const tabId = createNonSecureContextUuid()
    const number = nextTerminalNumber(current, worktreeId)
    markDockTabLive(tabId)
    markDockTabInteractive(tabId)
    setOwners({ ...owners, [tabId]: worktreeId })
    current.createTab(FLOATING_TERMINAL_WORKTREE_ID, groupId, undefined, { id: tabId, ...startup })
    current.setTabCustomTitle(
      tabId,
      translate('auto.components.revioLayout.terminalNumber', 'Terminal {{value0}}', {
        value0: number
      })
    )
    if (!current.floatingWorkspacePanelOpen) {
      current.setFloatingWorkspacePanelOpen(true)
    }
    focusTerminalTabSurface(tabId)
  })
  return worktreeId
}

/**
 * The dock's terminals belong to Orca's floating workspace, which runs on this Mac only. A remote
 * workspace (SSH host or cloud sandbox) gets its terminal as a tab on its own host instead, the
 * way the tab bar's terminal opens, and the dock stays closed.
 */
function openTerminalOnWorkspaceHost(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const groupId =
    state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id
  if (state.floatingWorkspacePanelOpen && !workspaceHasDockTab(worktreeId)) {
    state.setFloatingWorkspacePanelOpen(false)
  }
  if (!groupId) {
    return false
  }
  void state.openNewTerminalTabInActiveWorkspace(groupId)
  return true
}

/** The active workspace's newest live dock terminal, if it has one. */
export function findDockTerminalForWorkspace(
  liveTabIds: readonly string[],
  worktreeId: string | null
): string | null {
  for (let index = liveTabIds.length - 1; index >= 0; index -= 1) {
    const tabId = liveTabIds[index]
    if (tabId && isDockTabForWorkspace(tabId, worktreeId)) {
      return tabId
    }
  }
  return null
}

function workspaceHasDockTab(worktreeId: string): boolean {
  const liveTabIds = (
    useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []
  ).map((tab) => tab.id)
  return findDockTerminalForWorkspace(liveTabIds, worktreeId) !== null
}

/**
 * In the workspace layout the center holds chats only, so every "new terminal" lands in the dock.
 * Returns false outside the layout so the caller keeps Orca's own behaviour.
 */
export function openRevioDockTerminal(floatingGroupId?: string): boolean {
  const state = useAppStore.getState()
  if (state.settings?.revioLayout !== true) {
    return false
  }
  if (state.activeWorktreeId && isRemoteWorkspace(state.activeWorktreeId)) {
    // A cloud workspace's Setup and Run sit in the dock; opening it shows them.
    if (!state.floatingWorkspacePanelOpen && workspaceHasDockTab(state.activeWorktreeId)) {
      state.setFloatingWorkspacePanelOpen(true)
      return true
    }
    createRemoteDockTerminal(state.activeWorktreeId, floatingGroupId)
    return true
  }
  if (!state.floatingWorkspacePanelOpen) {
    // Opening the dock shows the workspace's terminal, creating one if it has none.
    state.setFloatingWorkspacePanelOpen(true)
    return true
  }
  return createDockTerminalForActiveWorkspace(floatingGroupId) !== null
}

/**
 * For Orca's own floating-terminal create paths: in the workspace layout, create a dock terminal.
 */
export function createRevioDockTerminal(groupId?: string, shellOverride?: string): boolean {
  return (
    useAppStore.getState().settings?.revioLayout === true &&
    createDockTerminalForActiveWorkspace(groupId, shellOverride) !== null
  )
}

/**
 * The Setup and Run tabs: a command runs in a dock tab of that name, replacing the tab a
 * previous run left; a cloud workspace's tab reaches its sandbox over ssh (`prepareCloudDock`).
 * Null outside the workspace layout and for other remote workspaces.
 */
export function runInRevioDock(
  worktreeId: string,
  title: string,
  command: string,
  env?: Record<string, string>
): string | null {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  if (state.settings?.revioLayout !== true || !worktree) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  const startup = withCleanScreen(
    dockTabStartup(worktree, repo, isRemoteWorkspace(worktreeId), command, env)
  )
  if (!startup) {
    return null
  }
  const tabId = claimDockTab(worktreeId, title)
  state.createTab(FLOATING_TERMINAL_WORKTREE_ID, undefined, undefined, { id: tabId, ...startup })
  state.setTabCustomTitle(tabId, title)
  if (!state.floatingWorkspacePanelOpen) {
    state.setFloatingWorkspacePanelOpen(true)
  }
  return tabId
}

/** A new dock tab id owned by the workspace; the tab a previous run of `title` left closes. */
export function claimDockTab(worktreeId: string, title: string): string {
  const state = useAppStore.getState()
  for (const tab of state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []) {
    if (owners[tab.id] === worktreeId && tab.customTitle === title) {
      state.closeTab(tab.id)
    }
  }
  const tabId = createNonSecureContextUuid()
  markDockTabLive(tabId)
  setOwners({ ...owners, [tabId]: worktreeId })
  return tabId
}

/**
 * Closes a remote workspace's dock tabs left from an earlier app session: their ssh line ended
 * with that session, so what remains is a shell on this Mac posing as the sandbox's Setup or Run.
 * Workspaces not listed yet are left for a later call.
 */
export function closeStaleRemoteDockTabs(): number {
  const live = readLiveTabs()
  const stale = new Set(
    Object.entries(owners)
      .filter(([tabId, worktreeId]) => !live.has(tabId) && isRemoteWorkspace(worktreeId))
      .map(([tabId]) => tabId)
  )
  if (stale.size === 0) {
    return 0
  }
  const state = useAppStore.getState()
  for (const tab of state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []) {
    if (stale.has(tab.id)) {
      state.closeTab(tab.id, { recordInteraction: false })
    }
  }
  setOwners(Object.fromEntries(Object.entries(owners).filter(([tabId]) => !stale.has(tabId))))
  return stale.size
}

/**
 * A removed workspace's dock tabs go with it. Its id is its path, so an unarchived workspace gets
 * the same id back and would otherwise reopen showing the old Setup and Run output.
 */
export function closeDockTabsOfWorkspaces(removed: ReadonlySet<string>): number {
  const state = useAppStore.getState()
  const doomed = Object.entries(owners)
    .filter(([, worktreeId]) => removed.has(worktreeId))
    .map(([tabId]) => tabId)
  if (doomed.length === 0) {
    return 0
  }
  const live = new Set(
    (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map((tab) => tab.id)
  )
  for (const tabId of doomed) {
    if (live.has(tabId)) {
      state.closeTab(tabId, { recordInteraction: false })
    }
  }
  const doomedSet = new Set(doomed)
  setOwners(Object.fromEntries(Object.entries(owners).filter(([tabId]) => !doomedSet.has(tabId))))
  return doomed.length
}

export { isInteractiveDockTab }
export { isRemoteWorkspace }
