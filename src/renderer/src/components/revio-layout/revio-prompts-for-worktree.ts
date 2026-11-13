import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { RevioPrompts } from '../../../../shared/revio-layout-settings-types'
import { mergeRevioPrompts } from '../../../../shared/revio-repo-prompts'

/** The prompts a workspace's one-click actions send: its repository's overrides, then the global ones. */
export function revioPromptsForWorktree(worktreeId: string): RevioPrompts {
  const state = useAppStore.getState()
  const repoId = findWorktreeById(selectWorktreesByRepo(state), worktreeId)?.repoId
  return mergeRevioPrompts(
    state.settings?.revioPrompts,
    repoId ? state.settings?.revioRepoPrompts?.[repoId] : undefined
  )
}
