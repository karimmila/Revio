import type { GlobalSettings } from '../../shared/global-settings-types'
import { repoActionsGenericInstruction } from './revio-repo-actions-instruction'

/** "Use GitHub stacked PRs": agents learn they may split one feature into a PR stack. */
export const STACKED_PULL_REQUESTS_INSTRUCTION = [
  'You can use GitHub stacked pull requests through the `gh stack` CLI. When one feature is large,',
  'split it into a stack of small dependent pull requests, each targeting the branch of the one below',
  'it, so each can be reviewed on its own. Use a stack when the user asks for one or when splitting',
  'clearly makes review easier; otherwise open a single pull request.'
].join(' ')

export type RevioInstructionSettings = Partial<
  Pick<
    GlobalSettings,
    | 'revioLayout'
    | 'revioStackedPullRequests'
    | 'revioGeneralPreferences'
    | 'revioRepoGeneralPreferences'
  >
>

/**
 * What the workspace layout tells every new Claude and Codex chat: the stacked-PR note and the
 * person's "General preferences". Null when there is nothing to add.
 */
export function revioAgentInstructions(settings: RevioInstructionSettings): string | null {
  if (settings.revioLayout !== true) {
    return null
  }
  const parts = [
    settings.revioStackedPullRequests !== false ? STACKED_PULL_REQUESTS_INSTRUCTION : '',
    settings.revioGeneralPreferences?.trim() ?? ''
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * The repository "General preferences" replace the global ones for chats in that repository (the
 * workspace layout reads the setting at the workspace's scope first). Only repositories with
 * non-blank text appear; null when there are none.
 */
export function revioRepoAgentInstructions(
  settings: RevioInstructionSettings
): Record<string, string> | null {
  if (settings.revioLayout !== true) {
    return null
  }
  const byRepo: Record<string, string> = {}
  for (const [repoId, preferences] of Object.entries(settings.revioRepoGeneralPreferences ?? {})) {
    const instructions = preferences.trim()
      ? revioAgentInstructions({ ...settings, revioGeneralPreferences: preferences })
      : null
    if (instructions) {
      byRepo[repoId] = instructions
    }
  }
  return Object.keys(byRepo).length > 0 ? byRepo : null
}

/**
 * Codex takes extra developer instructions as a config override; a JSON string is a valid TOML
 * basic string, so quotes and newlines survive `-c` parsing.
 */
export function codexInstructionArgs(settings: RevioInstructionSettings): string[] {
  if (settings.revioLayout !== true) {
    return []
  }
  // Codex's instructions are global to its app-server, so it gets the generic actions note only.
  const instructions = [revioAgentInstructions(settings), repoActionsGenericInstruction()]
    .filter(Boolean)
    .join('\n\n')
  return ['-c', `developer_instructions=${JSON.stringify(instructions)}`]
}
