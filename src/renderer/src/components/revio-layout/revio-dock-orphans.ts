import React from 'react'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  closeDockTabsOfWorkspaces,
  dockTabOwners,
  isDockTabForWorkspace,
  useDockTerminalOwners
} from './revio-dock-terminals'
import { readLiveTabs } from './revio-dock-session-tabs'
import { worktreeListingOf } from './revio-dock-sweep'
import { useRevioLayout } from './revio-layout'

export type DockOrphanFacts = {
  /** Dock tab id to the workspace it belongs to. */
  owners: Readonly<Record<string, string>>
  /** Dock tabs started in this app session; their workspace may only be reconnecting. */
  liveTabIds: ReadonlySet<string>
  listedWorktreeIds: ReadonlySet<string>
  /** Repositories whose workspace list has loaded. */
  listedRepoIds: ReadonlySet<string>
  /** Every repository the app knows, listed or still loading. */
  knownRepoIds: ReadonlySet<string>
}

/**
 * Workspaces that own dock tabs and no longer exist: the workspace is not listed, and either its
 * repository's list has loaded without it (archived) or the repository itself is gone (a removed
 * project; a deleted cloud workspace, whose sandbox was its whole repository). A repository
 * still loading orphans nothing, and neither does a workspace with a tab from this session.
 */
export function orphanDockWorkspaceIds(facts: DockOrphanFacts): Set<string> {
  const candidates = new Set<string>()
  const live = new Set<string>()
  for (const [tabId, worktreeId] of Object.entries(facts.owners)) {
    if (facts.liveTabIds.has(tabId)) {
      live.add(worktreeId)
    } else if (!facts.listedWorktreeIds.has(worktreeId)) {
      const repoId = worktreeId.split('::')[0] ?? ''
      if (facts.listedRepoIds.has(repoId) || !facts.knownRepoIds.has(repoId)) {
        candidates.add(worktreeId)
      }
    }
  }
  return new Set([...candidates].filter((worktreeId) => !live.has(worktreeId)))
}

let pruning = false

/**
 * Closes the dock tabs of workspaces that no longer exist. Left alone, each came back at every
 * launch as a hidden tab with its own login shell (78 of them in one profile, 2026-11-13).
 * It waits for the saved session and this Mac's repository list: before them every workspace
 * looks missing. With no repository on this Mac listed, the list may have failed to load, and
 * nothing closes.
 */
export async function closeOrphanDockTabs(): Promise<number> {
  if (pruning) {
    return 0
  }
  pruning = true
  try {
    await useAppStore.getState().awaitLocalRepoCatalogSettlement()
    const state = useAppStore.getState()
    const hasLocalRepo = state.repos.some((repo) => getRepoExecutionHostId(repo) === 'local')
    if (state.settings?.revioLayout !== true || !state.workspaceSessionReady || !hasLocalRepo) {
      return 0
    }
    const listing = worktreeListingOf(state)
    const orphans = orphanDockWorkspaceIds({
      owners: dockTabOwners(),
      liveTabIds: readLiveTabs(),
      listedWorktreeIds: listing.ids,
      listedRepoIds: listing.repoIds,
      knownRepoIds: new Set(state.repos.map((repo) => repo.id))
    })
    return orphans.size > 0 ? closeDockTabsOfWorkspaces(orphans) : 0
  } catch {
    return 0
  } finally {
    pruning = false
  }
}

/**
 * The dock tabs whose panes may mount: the active workspace's, and every one shown before in
 * this window. A pane starts its shell when it mounts, and the dock mounted every tab of every
 * workspace at once; a workspace's terminals now start when the person first opens it. Tabs
 * shown before stay mounted, so a running terminal is not torn down by a switch of workspace.
 */
export function dockMountTabIds(
  shownBefore: ReadonlySet<string>,
  tabIds: readonly string[],
  activeWorktreeId: string | null,
  owners: Readonly<Record<string, string>>
): ReadonlySet<string> {
  const next = new Set<string>()
  for (const tabId of tabIds) {
    if (shownBefore.has(tabId) || isDockTabForWorkspace(tabId, activeWorktreeId, owners)) {
      next.add(tabId)
    }
  }
  const same = next.size === shownBefore.size && [...next].every((id) => shownBefore.has(id))
  return same ? shownBefore : next
}

const EMPTY_TABS: readonly { id: string }[] = []

/** `dockMountTabIds` for the floating workspace; null outside the workspace layout (mount all). */
export function useRevioDockMountTabIds(): ReadonlySet<string> | null {
  const revioLayout = useRevioLayout()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const tabs = useAppStore((s) => s.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? EMPTY_TABS)
  const owners = useDockTerminalOwners()
  const shown = React.useRef<ReadonlySet<string>>(new Set())
  return React.useMemo(() => {
    if (!revioLayout) {
      return null
    }
    shown.current = dockMountTabIds(
      shown.current,
      tabs.map((tab) => tab.id),
      activeWorktreeId,
      owners
    )
    return shown.current
  }, [activeWorktreeId, owners, revioLayout, tabs])
}
