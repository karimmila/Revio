import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { isRemoteWorkspace } from './revio-workspace-host'
import { worktreeListingOf } from './revio-dock-sweep'

/**
 * Plain terminal tabs left in the center by an earlier session. The workspace layout's center holds
 * chats only, so these close; the bottom panel's terminals are separate tabs and stay. A terminal
 * tab showing a chat (view mode `chat`) is a chat and stays. Remote workspaces keep theirs: for an
 * SSH host, or a sandbox that is not running, a center tab is the only terminal Orca can open.
 */
export function revioCenterTerminalTabIds(
  unifiedTabsByWorktree: Readonly<
    Record<
      string,
      readonly { entityId: string; contentType: string; viewMode?: string }[] | undefined
    >
  >,
  keepsCenterTerminals: (worktreeId: string) => boolean
): string[] {
  const ids: string[] = []
  for (const [worktreeId, tabs] of Object.entries(unifiedTabsByWorktree ?? {})) {
    if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID || keepsCenterTerminals(worktreeId)) {
      continue
    }
    for (const tab of tabs ?? []) {
      if (tab.contentType === 'terminal' && tab.viewMode !== 'chat') {
        ids.push(tab.entityId)
      }
    }
  }
  return ids
}

const swept = new Set<string>()

/**
 * Closes the center's plain terminal tabs once per workspace, after the saved session loads and
 * the workspace is listed (an unlisted one could be remote). Later terminals are left alone.
 */
export function closeRevioCenterTerminalTabs(): number {
  const state = useAppStore.getState()
  if (state.settings?.revioLayout !== true || !state.workspaceSessionReady) {
    return 0
  }
  const listed = worktreeListingOf(state).ids
  const ids = revioCenterTerminalTabIds(
    state.unifiedTabsByWorktree,
    (worktreeId) =>
      !listed.has(worktreeId) || swept.has(worktreeId) || isRemoteWorkspace(worktreeId)
  )
  for (const worktreeId of listed) {
    swept.add(worktreeId)
  }
  for (const id of ids) {
    state.closeTab(id, { recordInteraction: false })
  }
  return ids.length
}
