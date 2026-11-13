import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'

type ScopedFilters = {
  filterRepoIds: readonly string[]
  hideDefaultBranchWorkspace: boolean
  alwaysShowDefaultBranchWorkspace?: boolean
}

const NO_REPO_IDS: readonly string[] = []
const NO_MATCHING_REPO = 'revio-location:none'

/**
 * In the workspace layout a workspace is a worktree of a Git repository: the repository's own
 * checkout and plain folder projects are never listed. Applied on top of the user's filters, which
 * it leaves as they are.
 */
export function scopeToRevioWorkspaces<T extends ScopedFilters>(
  filters: T,
  gitRepoIds: readonly string[]
): T {
  const repoIds =
    filters.filterRepoIds.length > 0
      ? filters.filterRepoIds.filter((id) => gitRepoIds.includes(id))
      : gitRepoIds
  return {
    ...filters,
    // An empty list means "no filter"; a location with no repositories must list nothing instead.
    filterRepoIds: repoIds.length > 0 ? repoIds : [NO_MATCHING_REPO],
    hideDefaultBranchWorkspace: true,
    alwaysShowDefaultBranchWorkspace: false
  }
}

/** Like the Mac / Cloud switch: each location lists only its own workspaces. */
export function useRevioWorkspaceScope<T extends ScopedFilters>(filters: T): T {
  const revioLayout = useAppStore((s) => s.settings?.revioLayout === true)
  const cloud = useAppStore((s) => s.settings?.revioLocation === 'cloud')
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  const gitRepoIds = useAppStore(
    useShallow((s) =>
      revioLayout
        ? s.repos
            .filter(
              (repo) => repo.kind !== 'folder' && isCloudRepo(repo, cloudEnvironmentIds) === cloud
            )
            .map((repo) => repo.id)
        : NO_REPO_IDS
    )
  )
  return useMemo(
    () => (revioLayout ? scopeToRevioWorkspaces(filters, gitRepoIds) : filters),
    [revioLayout, filters, gitRepoIds]
  )
}
