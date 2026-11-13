/** The workspace tabs bar keeps visited workspaces in visit order, up to a cap. */
export const WORKSPACE_TABS_MAX = 12

export function withVisitedWorkspace(tabs: readonly string[], worktreeId: string | null): string[] {
  if (!worktreeId || tabs.includes(worktreeId)) {
    return [...tabs]
  }
  return [...tabs, worktreeId].slice(-WORKSPACE_TABS_MAX)
}

/** Drops closed tabs and workspaces that no longer exist. */
export function withoutWorkspaceTab(
  tabs: readonly string[],
  removed: string,
  exists: (id: string) => boolean
): string[] {
  return tabs.filter((id) => id !== removed && exists(id))
}
