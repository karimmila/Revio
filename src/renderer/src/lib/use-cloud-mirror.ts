import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { CloudMirrorInfo } from '../../../shared/cloud/cloud-types'

const AUTO_SYNC_MS = 30_000

/** Shows the mirror under its local repository on the Mac, like any worktree Orca imported. */
async function showMirrorInSidebar(info: CloudMirrorInfo): Promise<void> {
  const state = useAppStore.getState()
  const repo = state.repos.find((candidate) => candidate.id === info.repoId)
  if (!repo || !info.mirrorPath) {
    return
  }
  const imported = repo.importedExternalWorktreePaths ?? []
  if (!imported.includes(info.mirrorPath)) {
    await state.updateRepo(repo.id, {
      importedExternalWorktreePaths: [...imported, info.mirrorPath]
    })
  }
  const listed = (selectWorktreesByRepo(useAppStore.getState())[repo.id] ?? []).some(
    (worktree) => worktree.path === info.mirrorPath
  )
  if (!listed) {
    await useAppStore.getState().fetchWorktrees(repo.id)
  }
}

/** How many agents in the workspace are mid-turn; a drop to zero means a turn just finished. */
function useWorkingAgents(worktreeId: string): number {
  return useAppStore((state) => {
    const tabIds = new Set((state.tabsByWorktree?.[worktreeId] ?? []).map((tab) => tab.id))
    let working = 0
    for (const entry of Object.values(state.agentStatusByPaneKey ?? {})) {
      const tabId = entry.tabId ?? entry.paneKey.split(':')[0]
      if ((entry.worktreeId === worktreeId || tabIds.has(tabId)) && entry.state === 'working') {
        working += 1
      }
    }
    return working
  })
}

/**
 * The cloud workspace's mirror on this Mac, synced one way from the sandbox: when the workspace
 * opens, every 30 seconds while it stays open, after each agent turn, and on "Sync now".
 */
export function useCloudMirror(
  worktreeId: string,
  environmentId: string
): {
  info: CloudMirrorInfo | null
  syncing: boolean
  lastResult: string | null
  syncNow: () => void
  setEnabled: (enabled: boolean) => void
} {
  const api = window.api.cloud
  const [info, setInfo] = React.useState<CloudMirrorInfo | null>(null)
  const [syncing, setSyncing] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<string | null>(null)
  const busy = React.useRef(false)
  const reload = React.useCallback(() => {
    void api
      ?.mirrorInfo(environmentId)
      .then((next) => {
        setInfo(next)
        return showMirrorInSidebar(next)
      })
      .catch(() => undefined)
  }, [api, environmentId])
  const syncNow = React.useCallback(() => {
    if (!api || busy.current) {
      return
    }
    busy.current = true
    setSyncing(true)
    void api
      .mirrorSync(environmentId)
      .then((status) => {
        setLastResult(
          status.state === 'synced'
            ? `${status.files} files${status.deleted ? `, ${status.deleted} removed` : ''}${status.skippedLinks ? `, ${status.skippedLinks} symlinks skipped` : ''}${status.skippedLarge ? `, ${status.skippedLarge} over 5 MB skipped` : ''}`
            : status.error
        )
      })
      .catch((error: unknown) =>
        setLastResult(error instanceof Error ? error.message : String(error))
      )
      .finally(() => {
        busy.current = false
        setSyncing(false)
        reload()
      })
  }, [api, environmentId, reload])
  React.useEffect(reload, [reload])
  const enabled = info?.enabled ?? false
  const active = useAppStore((state) => state.activeWorktreeId === worktreeId)
  React.useEffect(() => {
    if (!enabled || !active) {
      return
    }
    syncNow()
    const timer = window.setInterval(syncNow, AUTO_SYNC_MS)
    return () => window.clearInterval(timer)
  }, [active, enabled, syncNow])
  const working = useWorkingAgents(worktreeId)
  const wasWorking = React.useRef(working)
  React.useEffect(() => {
    if (wasWorking.current > 0 && working === 0 && enabled) {
      syncNow()
    }
    wasWorking.current = working
  }, [enabled, syncNow, working])
  return {
    info,
    syncing,
    lastResult,
    syncNow,
    setEnabled: (next) => {
      void api?.mirrorSetEnabled(environmentId, next).then(reload)
    }
  }
}
