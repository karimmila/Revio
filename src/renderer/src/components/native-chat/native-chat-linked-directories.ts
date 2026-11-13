import type { Worktree } from '../../../../shared/worktree/types'

type LinkableWorkspace = Pick<Worktree, 'id' | 'path' | 'displayName' | 'hostId'>

/** Removes a folder from a workspace's `/add-dir` list; an empty list is dropped. */
export function withoutLinkedDirectory(
  linked: Readonly<Record<string, string[]>> | undefined,
  workspacePath: string,
  folder: string
): Record<string, string[]> {
  const rest = (linked?.[workspacePath] ?? []).filter((entry) => entry !== folder)
  const next = { ...linked }
  if (rest.length > 0) {
    next[workspacePath] = rest
  } else {
    delete next[workspacePath]
  }
  return next
}

/** The other workspaces a chat can link: same host as the chat's own, by name. */
export function linkableWorkspaces<T extends LinkableWorkspace>(
  worktreesByRepo: Readonly<Record<string, readonly T[]>> | undefined,
  current: Pick<LinkableWorkspace, 'path' | 'hostId'>
): T[] {
  return Object.values(worktreesByRepo ?? {})
    .flat()
    .filter((worktree) => worktree.path !== current.path && worktree.hostId === current.hostId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
