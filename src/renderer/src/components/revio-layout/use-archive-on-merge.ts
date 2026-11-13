import React from 'react'
import { useAppStore } from '@/store'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import { revioArchivesWithoutAsking } from '@/lib/revio-archive'

/** Whether a PR that just turned merged should archive its workspace (Archive on merge). */
export function shouldArchiveOnMerge(args: {
  enabled: boolean
  wasOpen: boolean
  merged: boolean
  cloud: boolean
  stackHasOpenPrs: boolean
  agentsQuiet: boolean
}): boolean {
  return (
    args.enabled &&
    args.wasOpen &&
    args.merged &&
    !args.cloud &&
    !args.stackHasOpenPrs &&
    args.agentsQuiet
  )
}

/**
 * Archive on merge also when the PR merges on GitHub while Orca watches it: the workspace's own PR
 * going from open to merged archives it, except in the cloud, under a stack with open PRs, or while
 * an agent still works (the workspace layout refuses then).
 */
export function useArchiveOnMerge(args: {
  worktreeId: string | null
  prNumber: number | null
  merged: boolean
  cloud: boolean
  stackHasOpenPrs: boolean
}): void {
  const enabled = useAppStore((s) => s.settings?.revioArchiveOnMerge === true)
  const seen = React.useRef<{ key: string; merged: boolean } | null>(null)
  const { worktreeId, prNumber, merged, cloud, stackHasOpenPrs } = args
  React.useEffect(() => {
    const key = `${worktreeId ?? ''}#${prNumber ?? ''}`
    const previous = seen.current?.key === key ? seen.current : null
    seen.current = { key, merged }
    if (
      worktreeId &&
      shouldArchiveOnMerge({
        enabled,
        wasOpen: previous !== null && !previous.merged,
        merged,
        cloud,
        stackHasOpenPrs,
        agentsQuiet: revioArchivesWithoutAsking(worktreeId)
      })
    ) {
      runWorktreeDelete(worktreeId)
    }
  }, [cloud, enabled, merged, prNumber, stackHasOpenPrs, worktreeId])
}
