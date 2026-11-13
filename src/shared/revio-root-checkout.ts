import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from './execution-host'

type RootCheckoutSettings = { revioLayout?: boolean } | null | undefined
type RootCheckoutRepo = {
  id: string
  kind?: string
  connectionId?: string | null
  executionHostId?: string | null
}
type RootCheckoutWorktree = {
  id: string
  repoId: string
  isMainWorktree?: boolean
  ephemeralVmCheckoutMode?: string
}

/**
 * In the workspace layout a workspace is a worktree the app made. The repository's own checkout on
 * this Mac is the person's working copy: it is never listed, and it must never open as a
 * workspace, because a prompt or a terminal there would run in their real checkout. A cloud
 * workspace is its sandbox's checkout root, so only local repositories are covered.
 */
export function isRevioRootCheckout(
  settings: RootCheckoutSettings,
  repos: readonly RootCheckoutRepo[],
  worktree: RootCheckoutWorktree | null | undefined
): boolean {
  if (settings?.revioLayout !== true || !worktree?.isMainWorktree) {
    return false
  }
  if (worktree.ephemeralVmCheckoutMode === 'provisioned-root') {
    return false
  }
  const repo = repos.find((candidate) => candidate.id === worktree.repoId)
  return (
    repo !== undefined &&
    repo.kind !== 'folder' &&
    getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
  )
}

/** The ids of every root checkout in the listed worktrees; empty outside the workspace layout. */
export function revioRootCheckoutIds(
  settings: RootCheckoutSettings,
  repos: readonly RootCheckoutRepo[],
  worktreesByRepo: Readonly<Record<string, readonly RootCheckoutWorktree[]>>
): Set<string> {
  const ids = new Set<string>()
  if (settings?.revioLayout !== true) {
    return ids
  }
  for (const worktrees of Object.values(worktreesByRepo)) {
    for (const worktree of worktrees) {
      if (isRevioRootCheckout(settings, repos, worktree)) {
        ids.add(worktree.id)
      }
    }
  }
  return ids
}

/**
 * What the workspace layout's lists leave out: every root checkout, and a folder project's own
 * folder on this Mac. Home lists neither, so the palette showed a "primary" row (the old home
 * project's `~`, for one) that nothing else in the layout has. A folder project's folder is not
 * a root checkout: it is left out of lists only, and still opens where something names it.
 */
export function revioUnlistedCheckoutIds(
  settings: RootCheckoutSettings,
  repos: readonly RootCheckoutRepo[],
  worktreesByRepo: Readonly<Record<string, readonly RootCheckoutWorktree[]>>
): Set<string> {
  const ids = revioRootCheckoutIds(settings, repos, worktreesByRepo)
  if (settings?.revioLayout !== true) {
    return ids
  }
  for (const worktrees of Object.values(worktreesByRepo)) {
    for (const worktree of worktrees) {
      const repo = repos.find((candidate) => candidate.id === worktree.repoId)
      if (
        worktree.isMainWorktree &&
        repo?.kind === 'folder' &&
        getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
      ) {
        ids.add(worktree.id)
      }
    }
  }
  return ids
}

/** A map keyed by worktree id without the root checkouts; the same object when none is in it. */
export function withoutRevioRootCheckoutKeys<T>(
  byWorktreeId: Readonly<Record<string, T>>,
  rootIds: ReadonlySet<string>
): Readonly<Record<string, T>> {
  if (rootIds.size === 0 || !Object.keys(byWorktreeId).some((id) => rootIds.has(id))) {
    return byWorktreeId
  }
  return Object.fromEntries(Object.entries(byWorktreeId).filter(([id]) => !rootIds.has(id)))
}

/** Each repository's worktrees without its root checkout; the same object when nothing changes. */
export function withoutRevioRootCheckouts<T extends RootCheckoutWorktree>(
  worktreesByRepo: Readonly<Record<string, T[]>>,
  rootIds: ReadonlySet<string>
): Readonly<Record<string, T[]>> {
  if (rootIds.size === 0) {
    return worktreesByRepo
  }
  return Object.fromEntries(
    Object.entries(worktreesByRepo).map(([repoId, worktrees]) => [
      repoId,
      worktrees.filter((worktree) => !rootIds.has(worktree.id))
    ])
  )
}
