import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { workspacePreviewUrls } from './revio-open-localhost'
import type { Runnable } from '../../../../shared/actions/repo-action-runnables'

export type { Runnable }

export function usePreviewUrls(worktreeId: string | null): string[] {
  const [urls, setUrls] = React.useState<string[]>([])
  const [revision, setRevision] = React.useState(0)
  React.useEffect(
    () => window.api.repoActions?.onChanged(() => setRevision((current) => current + 1)),
    []
  )
  React.useEffect(() => {
    let live = true
    if (!worktreeId) {
      setUrls([])
      return
    }
    void workspacePreviewUrls(worktreeId).then((next) => {
      if (live) {
        setUrls(next)
      }
    })
    return () => {
      live = false
    }
  }, [revision, worktreeId])
  return urls
}

/** ORCA_PORT and the other script variables, for runs on this Mac (a cloud run has its own). */
export async function workspaceScriptEnv(
  sourceRepoId: string,
  entry: Runnable
): Promise<Record<string, string>> {
  if (entry.group === 'cloud') {
    return {}
  }
  const worktree = findWorktreeById(selectWorktreesByRepo(useAppStore.getState()), entry.worktreeId)
  if (!worktree) {
    return {}
  }
  return (
    (await window.api.repoActions?.scriptEnv(sourceRepoId, worktree.path).catch(() => null)) ?? {}
  )
}

/** The repository root's own workspace (its main checkout), where Spotlight runs actions. */
export function rootWorktreeId(repoId: string): string | null {
  return (
    (selectWorktreesByRepo(useAppStore.getState())[repoId] ?? []).find(
      (worktree) => worktree.isMainWorktree
    )?.id ?? null
  )
}

export function repoWorktreeIds(repoId: string): string[] {
  return (selectWorktreesByRepo(useAppStore.getState())[repoId] ?? []).map(
    (worktree) => worktree.id
  )
}
