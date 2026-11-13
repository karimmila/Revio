import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { SetupScriptPromptInspection } from '@/lib/setup-script-prompt'
import { findRepoForHost } from '@/store/slices/repo-host-identity'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'

export type SetupScriptPromptState = SetupScriptPromptInspection & {
  repoHostIdentity: string
}

export type LastVisibleSetupScriptPrompt = {
  state: SetupScriptPromptState
}

export function findSetupScriptPromptRepo(input: {
  repos: readonly Repo[]
  activeRepoId: string | null
  activeWorktree: Pick<Worktree, 'hostId' | 'repoId' | 'runtimeOwnerEnvironmentId'> | null
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null
}): Repo | null {
  const { activeRepoId, activeWorktree, repos, settings } = input
  if (!activeRepoId) {
    return null
  }
  // Why: runtime-relayed SSH worktrees expose their transport host separately from the repo catalog owner.
  const runtimeOwnerEnvironmentId = activeWorktree?.runtimeOwnerEnvironmentId?.trim()
  const activeWorktreeHostId =
    activeWorktree?.repoId === activeRepoId
      ? runtimeOwnerEnvironmentId
        ? toRuntimeExecutionHostId(runtimeOwnerEnvironmentId)
        : activeWorktree.hostId
      : undefined
  return findRepoForHost(repos, activeRepoId, {
    settings,
    ...(activeWorktreeHostId ? { hostId: activeWorktreeHostId } : {})
  })
}

/**
 * Whether the card has a project to speak for. In the workspace layout that is a project the
 * person is inside of: a workspace of it is open and it is not only the project's own folder.
 * On Home no project is in view, and the last active one made the card show at every launch.
 * The classic layout keeps its rule: the active project.
 */
export function setupScriptPromptHasContext(input: {
  revioLayout: boolean
  repoId: string
  activeWorktree: Pick<Worktree, 'repoId'> | null
  repoWorktrees: readonly Pick<Worktree, 'isMainWorktree'>[]
}): boolean {
  if (!input.revioLayout) {
    return true
  }
  return (
    input.activeWorktree?.repoId === input.repoId &&
    input.repoWorktrees.some((worktree) => !worktree.isMainWorktree)
  )
}

export function markSetupScriptPromptSaved(
  current: SetupScriptPromptState | null,
  savedRepoHostIdentity: string
): SetupScriptPromptState | null {
  return current?.repoHostIdentity === savedRepoHostIdentity && current.status === 'ok'
    ? { ...current, hasEffectiveSetup: true }
    : current
}

export function getRenderedSetupScriptPromptState(input: {
  promptState: SetupScriptPromptState | null
  activeRepoId: string
  activeRepoHostIdentity: string
  lastVisiblePrompt: LastVisibleSetupScriptPrompt | null
}): SetupScriptPromptState | null {
  const { activeRepoHostIdentity, activeRepoId, lastVisiblePrompt, promptState } = input
  if (
    promptState?.repoId === activeRepoId &&
    promptState.repoHostIdentity === activeRepoHostIdentity
  ) {
    return promptState
  }
  return !promptState && lastVisiblePrompt?.state.repoHostIdentity === activeRepoHostIdentity
    ? lastVisiblePrompt.state
    : null
}
