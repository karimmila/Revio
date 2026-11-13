import type { AppState } from '../../types'

export type LandingState = Pick<
  AppState,
  | 'activeWorktreeId'
  | 'unifiedTabsByWorktree'
  | 'tabsByWorktree'
  | 'browserTabsByWorktree'
  | 'openFiles'
  | 'activeTabIdByWorktree'
  | 'activeBrowserTabIdByWorktree'
  | 'activeFileIdByWorktree'
  | 'activeTabTypeByWorktree'
  | 'settings'
>

export function landsOnEmptiedWorktree(
  current: LandingState,
  worktreeId: string,
  remainingTabs: number
): boolean {
  // The workspace layout keeps the emptied workspace open on its empty state.
  return (
    current.settings?.revioLayout !== true &&
    current.activeWorktreeId === worktreeId &&
    remainingTabs === 0 &&
    (current.tabsByWorktree[worktreeId] ?? []).length === 0 &&
    (current.browserTabsByWorktree[worktreeId] ?? []).length === 0 &&
    !current.openFiles.some((file) => file.worktreeId === worktreeId)
  )
}
