import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { areCloudEnvironmentIdsKnown, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { decideLocationFocus, locationMembership, type RevioLocation } from './revio-location-focus'

// The last workspace used in each location, for this window's session.
const lastUsed = new Map<RevioLocation, string>()

/** Keeps the main area on the current location's workspaces (see `decideLocationFocus`). */
export function useRevioLocationFocus(location: RevioLocation): void {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  const shownLocation = React.useRef(location)
  // A switch stays pending until the data to act on it has loaded.
  const pendingSwitch = React.useRef(false)
  React.useEffect(() => {
    if (shownLocation.current !== location) {
      shownLocation.current = location
      pendingSwitch.current = true
    }
    const facts = {
      repos,
      repoWorktrees: worktreesByRepo,
      cloudEnvironmentIds,
      cloudEnvironmentIdsKnown: areCloudEnvironmentIdsKnown()
    }
    const membership = (worktreeId: string): ReturnType<typeof locationMembership> =>
      locationMembership(worktreeId, location, facts)
    if (activeWorktreeId && membership(activeWorktreeId) === 'yes') {
      lastUsed.set(location, activeWorktreeId)
    }
    const decision = decideLocationFocus({
      activeWorktreeId,
      rememberedWorktreeId: lastUsed.get(location) ?? null,
      switched: pendingSwitch.current,
      membership
    })
    if (decision.kind === 'wait') {
      return
    }
    pendingSwitch.current = false
    if (decision.kind === 'open') {
      void activateWorktreeFromSidebar(decision.worktreeId)
    } else if (decision.kind === 'home') {
      useAppStore.getState().setActiveWorktree(null)
    }
  }, [activeWorktreeId, cloudEnvironmentIds, location, repos, worktreesByRepo])
}
