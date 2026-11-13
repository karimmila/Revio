import { findDockTerminalForWorkspace, isRemoteWorkspace } from './revio-dock-terminals'

/**
 * True for a remote workspace with no Setup or Run tab in the dock: the dock then has nothing of
 * that workspace to show. Never true for a workspace on this Mac, which gets a terminal instead.
 */
export function dockHasNothingForWorkspace(
  worktreeId: string | null,
  liveDockTabIds: readonly string[],
  remote: (worktreeId: string) => boolean = isRemoteWorkspace
): boolean {
  return (
    worktreeId !== null &&
    remote(worktreeId) &&
    findDockTerminalForWorkspace(liveDockTabIds, worktreeId) === null
  )
}
