import type { GlobalSettings } from './global-settings-types'

/**
 * Orca deletes a removed workspace's local branch (safely, `git branch -d`). In the workspace
 * layout that only happens when "Delete branch on archive" is on, so by default the branch is kept.
 */
export function archiveMayDeleteBranch(
  settings: Pick<GlobalSettings, 'revioLayout' | 'revioDeleteBranchOnArchive'> | undefined
): boolean {
  return settings?.revioLayout !== true || settings.revioDeleteBranchOnArchive === true
}

/** Whether removing this workspace deletes its local branch: never a reused branch, and in the
 *  Workspace layout only with "Delete branch on archive" on. */
export function archiveDeletesBranch(
  meta: { preserveBranchOnDelete?: boolean } | undefined,
  store: {
    getSettings: () => Pick<GlobalSettings, 'revioLayout' | 'revioDeleteBranchOnArchive'>
  }
): boolean {
  return meta?.preserveBranchOnDelete !== true && archiveMayDeleteBranch(store.getSettings())
}
