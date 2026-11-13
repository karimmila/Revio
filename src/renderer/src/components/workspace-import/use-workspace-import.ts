import { useCallback, useEffect, useState } from 'react'
import type {
  WorkspaceImportProgress,
  WorkspaceImportRepositoryScripts,
  WorkspaceImportResult,
  WorkspaceImportSummary
} from '../../../../shared/workspace-import-types'

export type WorkspaceImportState =
  | { phase: 'checking' }
  | { phase: 'absent' }
  | { phase: 'ready'; summary: WorkspaceImportSummary }
  | {
      phase: 'importing'
      summary: WorkspaceImportSummary
      progress: WorkspaceImportProgress | null
    }
  | { phase: 'done'; summary: WorkspaceImportSummary; result: WorkspaceImportResult }
  | { phase: 'failed'; summary: WorkspaceImportSummary }

/** Only active workspaces are imported; archived ones stay in the source app. */
export function pendingCounts(summary: WorkspaceImportSummary): {
  workspaces: number
  chats: number
} {
  return summary.pending.active
}

export function useWorkspaceImport(initial?: WorkspaceImportSummary): {
  state: WorkspaceImportState
  /** `approve` shows the scripts the repositories commit and returns the approved hashes. */
  start: (
    approve: (scripts: WorkspaceImportRepositoryScripts[]) => Promise<string[]>
  ) => Promise<void>
} {
  const [state, setState] = useState<WorkspaceImportState>(
    initial ? { phase: 'ready', summary: initial } : { phase: 'checking' }
  )
  useEffect(() => {
    let live = true
    const api = window.api.workspaceImport
    if (initial) {
      return
    }
    if (!api) {
      setState({ phase: 'absent' })
      return
    }
    void api
      .detect()
      .then((detection) => {
        if (live) {
          setState(
            detection.found ? { phase: 'ready', summary: detection.summary } : { phase: 'absent' }
          )
        }
      })
      .catch(() => live && setState({ phase: 'absent' }))
    return () => {
      live = false
    }
  }, [initial])
  const start = useCallback(
    async (approve: (scripts: WorkspaceImportRepositoryScripts[]) => Promise<string[]>) => {
      const api = window.api.workspaceImport
      if (!api || (state.phase !== 'ready' && state.phase !== 'failed')) {
        return
      }
      const { summary } = state
      setState({ phase: 'importing', summary, progress: null })
      const stop = api.onProgress((progress) =>
        setState((current) => (current.phase === 'importing' ? { ...current, progress } : current))
      )
      try {
        // The repositories are first read here, after the person asked for the import.
        const prepared = await api.prepare().catch(() => ({ repositoryScripts: [] }))
        const approvedScriptHashes = await approve(prepared.repositoryScripts)
        const result = await api.run({
          includeArchived: false,
          includeScripts: true,
          approvedScriptHashes
        })
        setState({ phase: 'done', summary, result })
      } catch {
        setState({ phase: 'failed', summary })
      } finally {
        stop()
      }
    },
    [state]
  )
  return { state, start }
}
