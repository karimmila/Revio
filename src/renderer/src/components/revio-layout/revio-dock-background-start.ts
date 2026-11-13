import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { isWindowsUserAgent } from '@/lib/user-agent-platform'
import { quotePosixShell } from '../../../../shared/shell/launch/shell-argument-quoting'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { dockTabStartup } from './revio-cloud-dock'
import { claimDockTab, dockTabOwner, isRemoteWorkspace } from './revio-dock-terminals'

// Erases the screen and scrollback: the shell echoes the line that starts the command (for a long
// one, `. '/var/folders/…/orca-launch-….sh'`), which is Orca's plumbing, not the command's output.
const CLEAR_SCREEN = `printf '\\033[H\\033[2J\\033[3J'`

/** The line the dock's shell on this Mac runs: a clean screen, the folder, then the command. */
export function backgroundDockLine(command: string, cwd: string | undefined): string {
  const inFolder = cwd ? `cd ${quotePosixShell(cwd)} && ${command}` : command
  return isWindowsUserAgent() ? inFolder : `${CLEAR_SCREEN}; ${inFolder}`
}

/**
 * Starts a command in a dock tab of the workspace without the panel showing. A dock tab created
 * in the window starts its terminal only when its pane mounts, and the dock's panes mount only
 * while the panel shows, so a Setup tab made at Create waited for the user to open the panel.
 * Here main starts the terminal (in Orca's floating workspace, which the dock shows) at once and
 * the window adopts it as the tab under the id claimed for the workspace; its output stays in
 * main's buffer for the pane to show, and for "Setup script failed — fix it?" to read.
 *
 * Returns the dock tab's id, or null when the dock cannot run the command (outside the workspace
 * layout layout, or another remote workspace), so the caller keeps its own tab. `reveal: false`
 * keeps the panel as it is.
 */
export function startInRevioDockInBackground(
  worktreeId: string,
  title: string,
  command: string,
  env?: Record<string, string>,
  options: { reveal?: boolean } = {}
): string | null {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  if (state.settings?.revioLayout !== true || !worktree) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  const startup = dockTabStartup(worktree, repo, isRemoteWorkspace(worktreeId), command, env)
  if (!startup) {
    return null
  }
  const tabId = claimDockTab(worktreeId, title)
  const startupEnv = startup.pendingStartup.env
  const reveal = (): void => {
    if (options.reveal !== false) {
      showDockTabIfWorkspaceActive(worktreeId, tabId)
    }
  }
  // The window's own tab, started when its pane mounts: the path before main started setup.
  const startInWindow = (): void => {
    useAppStore.getState().createTab(FLOATING_TERMINAL_WORKTREE_ID, undefined, undefined, {
      id: tabId,
      activate: false,
      recordInteraction: false,
      ...startup,
      pendingStartup: {
        ...startup.pendingStartup,
        command: backgroundDockLine(startup.pendingStartup.command, undefined)
      }
    })
    useAppStore.getState().setTabCustomTitle(tabId, title, { recordInteraction: false })
  }
  void callRuntimeRpc<{ terminal?: { ptyId?: string } }>(
    { kind: 'local' },
    'terminal.create',
    {
      worktree: `id:${FLOATING_TERMINAL_WORKTREE_ID}`,
      command: backgroundDockLine(startup.pendingStartup.command, startup.startupCwd),
      ...(startupEnv ? { env: startupEnv } : {}),
      title,
      tabId,
      presentation: 'background'
    },
    { timeoutMs: 30_000 }
  ).then(
    (reply) => {
      const ptyId = reply?.terminal?.ptyId
      if (!hasDockTab(tabId)) {
        // Main reveals no tab for a background create, so the window adopts the running
        // terminal itself; its pane attaches to it when the panel shows.
        if (ptyId) {
          adoptDockTab(tabId, ptyId, title, startup.startupCwd)
          dropUnownedTwinsOf(tabId, ptyId)
        } else {
          startInWindow()
        }
      }
      reveal()
    },
    (error: unknown) => {
      // A tab main did adopt ran the command already; running it again would be worse than a
      // slow reply.
      if (hasDockTab(tabId)) {
        return
      }
      console.warn('[revio-dock] background start failed; the tab starts when shown', error)
      startInWindow()
      reveal()
    }
  )
  return tabId
}

/** As a dock run does, the panel opens on the new tab, but only for the workspace on screen. */
function showDockTabIfWorkspaceActive(worktreeId: string, tabId: string): void {
  const state = useAppStore.getState()
  if (state.activeWorktreeId !== worktreeId || !hasDockTab(tabId)) {
    return
  }
  state.setActiveTabForWorktree(FLOATING_TERMINAL_WORKTREE_ID, tabId)
  if (!state.floatingWorkspacePanelOpen) {
    state.setFloatingWorkspacePanelOpen(true)
  }
}

function hasDockTab(tabId: string): boolean {
  return (useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).some(
    (tab) => tab.id === tabId
  )
}

function adoptDockTab(
  tabId: string,
  ptyId: string,
  title: string,
  startupCwd: string | undefined
): void {
  const state = useAppStore.getState()
  state.createTab(FLOATING_TERMINAL_WORKTREE_ID, undefined, undefined, {
    id: tabId,
    initialPtyId: ptyId,
    activate: false,
    recordInteraction: false,
    ...(startupCwd ? { startupCwd } : {})
  })
  useAppStore.getState().setTabCustomTitle(tabId, title, { recordInteraction: false })
}

const TWIN_WATCH_MS = 15_000

function ptyIdsOfTab(state: ReturnType<typeof useAppStore.getState>, tabId: string): string[] {
  const tab = (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).find(
    (candidate) => candidate.id === tabId
  )
  const fromLayout = Object.values(state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId ?? {})
  return [...(tab?.ptyId ? [tab.ptyId] : []), ...fromLayout.filter((id) => typeof id === 'string')]
}

/**
 * Main also publishes a background terminal to this window as its own tab, under another id. That
 * twin has no dock owner, so it never shows, but it held the same process as the Setup or Run tab
 * (seen 2026-11-10 as a "." tab). Its state goes, as after a process exit, so the process is not
 * stopped; the owned tab keeps it.
 */
export function dropUnownedTwinsOf(ownedTabId: string, ptyId: string): void {
  const drop = (): void => {
    const state = useAppStore.getState()
    for (const tab of state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []) {
      if (
        tab.id !== ownedTabId &&
        dockTabOwner(tab.id) === null &&
        ptyIdsOfTab(state, tab.id).includes(ptyId)
      ) {
        state.closeTab(tab.id, { reason: 'pty-exit', recordInteraction: false })
      }
    }
  }
  drop()
  if (typeof useAppStore.subscribe !== 'function') {
    return
  }
  // The twin can arrive after the reply, with the next runtime graph publication.
  const unsubscribe = useAppStore.subscribe((state, previous) => {
    if (
      state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] !==
      previous.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]
    ) {
      drop()
    }
  })
  setTimeout(unsubscribe, TWIN_WATCH_MS)
}
