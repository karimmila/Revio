import { useMemo, type DependencyList } from 'react'
import { isCloudMirrorPath, isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import type { Repo } from '../../../../shared/repo-types'
import { setupScriptPromptHasContext } from './setup-script-prompt-render-state'

export { findSetupScriptPromptRepo } from './setup-script-prompt-render-state'

/**
 * The repository the setup-script card speaks for, minus cloud workspaces and their mirrors: their scripts live in
 * the repository's Cloud settings, not in a hook file inside the sandbox. In the workspace layout
 * it is also a project the person is inside of (`setupScriptPromptHasContext`).
 */
export function useSetupScriptPromptRepo(
  find: () => Repo | null,
  deps: DependencyList
): Repo | null {
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  // Worktree ids are "<repoId>::<path>"; a cloud mirror is a copy, not a place to set up.
  const inMirror = useAppStore((s) => isCloudMirrorPath(s.activeWorktreeId?.split('::')[1]))
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps cover `find`.
  const repo = useMemo(find, deps)
  const repoId = repo?.id ?? null
  const inContext = useAppStore((s) => {
    if (!repoId) {
      return false
    }
    const worktreesByRepo = selectWorktreesByRepo(s)
    return setupScriptPromptHasContext({
      revioLayout: s.settings?.revioLayout === true,
      repoId,
      activeWorktree: s.activeWorktreeId
        ? (findWorktreeById(worktreesByRepo, s.activeWorktreeId) ?? null)
        : null,
      repoWorktrees: worktreesByRepo[repoId] ?? []
    })
  })
  return repo && inContext && !inMirror && !isCloudRepo(repo, cloudEnvironmentIds) ? repo : null
}
