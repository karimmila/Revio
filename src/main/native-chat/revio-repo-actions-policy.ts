import type { ClaudeStructuredAuthPolicy } from '../claude-accounts/claude-structured-auth-policy'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { Repo } from '../../shared/repo-types'
import { readRepoActions } from '../actions/repo-actions-store'
import {
  repoActionsGenericInstruction,
  repoActionsInstruction
} from './revio-repo-actions-instruction'

/**
 * In the workspace layout, a Claude chat's system prompt names its repository's actions so the
 * agent runs them with `orca action run`. A repository Orca cannot read (a cloud workspace's
 * remote one) or one whose actions fail to load gets the generic note instead.
 */
export function withRepoActionsInstruction(
  policy: ClaudeStructuredAuthPolicy,
  settings: Partial<Pick<GlobalSettings, 'revioLayout'>>,
  getRepos: () => readonly Pick<Repo, 'id' | 'path'>[],
  readActions: typeof readRepoActions = readRepoActions
): ClaudeStructuredAuthPolicy {
  if (settings.revioLayout !== true) {
    return policy
  }
  return {
    ...policy,
    repoActionsInstruction: (repoId) => {
      const repo = repoId ? getRepos().find((candidate) => candidate.id === repoId) : undefined
      if (!repo) {
        return repoActionsGenericInstruction()
      }
      try {
        return repoActionsInstruction(readActions(repo).actions)
      } catch {
        return repoActionsGenericInstruction()
      }
    }
  }
}
