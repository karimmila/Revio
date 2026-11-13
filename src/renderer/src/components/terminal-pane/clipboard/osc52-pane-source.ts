import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { dockTabOwner, isInteractiveDockTab } from '@/components/revio-layout/revio-dock-terminals'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import {
  getWorktreeExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../../../../shared/execution-host'
import { resolveOsc52PaneSource, type Osc52PaneSource } from './osc52-remote-policy'

export type Osc52PaneOrigin = {
  source: Osc52PaneSource
  cloud: boolean
  /** Milliseconds since the person last typed into the pane; Infinity when never. */
  sinceTypedMs: number
}

/** Null while the workspace is unknown (still loading, or owned by another host). */
function workspaceHost(worktreeId: string): { remote: boolean; cloud: boolean } | null {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  if (!worktree) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  return {
    remote: getWorktreeExecutionHostId(worktree, repo) !== LOCAL_EXECUTION_HOST_ID,
    cloud: repo ? isCloudRepo(repo, cloudEnvironmentIdsNow()) : false
  }
}

/**
 * Read at write time, not at mount: an agent can start in a shell pane after it mounts, and a
 * tab can move between workspaces. A pane whose tab is gone fails closed as a stream.
 */
export function osc52PaneOrigin(tabId: string, paneKey: string, now = Date.now()): Osc52PaneOrigin {
  const state = useAppStore.getState()
  const typedAt = state.lastTerminalInputAtByPaneKey[paneKey]
  const sinceTypedMs = typedAt === undefined ? Number.POSITIVE_INFINITY : now - typedAt
  // Anything this cannot place fails closed as a stream: a missing tab or an unknown workspace.
  const unknown: Osc52PaneOrigin = { source: 'remote-stream', cloud: false, sinceTypedMs }
  const tab = Object.values(state.tabsByWorktree)
    .flat()
    .find((candidate) => candidate.id === tabId)
  if (!tab) {
    return unknown
  }
  if (tab.worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    // Dock tabs run on this Mac; a remote workspace's dock tabs are ssh lines into its host.
    const owner = dockTabOwner(tab.id)
    const host = owner ? workspaceHost(owner) : { remote: false, cloud: false }
    if (!host) {
      return unknown
    }
    // A remote workspace's numbered dock terminal is a shell; its Setup and Run tabs are logs.
    return {
      source: resolveOsc52PaneSource({
        remote: host.remote,
        remoteDockStream: host.remote && !isInteractiveDockTab(tab.id),
        agent: Boolean(state.agentStatusByPaneKey[paneKey])
      }),
      cloud: host.cloud,
      sinceTypedMs
    }
  }
  const host = workspaceHost(tab.worktreeId)
  if (!host) {
    return unknown
  }
  const agent = Boolean(tab.launchAgent) || Boolean(state.agentStatusByPaneKey[paneKey])
  return {
    source: resolveOsc52PaneSource({ remote: host.remote, remoteDockStream: false, agent }),
    cloud: host.cloud,
    sinceTypedMs
  }
}
