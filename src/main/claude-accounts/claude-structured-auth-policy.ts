import type { AgentSessionAccountKind } from '../../shared/agent-session/agent-session-availability'
import { isOrcaCloudSandboxHost } from './cloud-sandbox-claude'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { getClaudeProfileRouter } from './claude-profile-installed-router'
import { isHostManagedClaudeAccount } from './environment'
import { getSelectedClaudeAccountIdForTarget } from './runtime-selection'
import { claudeProviderFromSettings } from '../../shared/claude-provider-env'
import {
  revioAgentInstructions,
  revioRepoAgentInstructions
} from '../native-chat/revio-agent-instructions'
import { claudeOutputStyleSettings } from '../../shared/revio-agent-style'

/** Label sign-in failures without changing inherited Anthropic authentication. */
export type ClaudeStructuredAuthPolicy = {
  account: AgentSessionAccountKind
  /**
   * The workspace layout with the Claude subscription: without an app-managed account, the launch
   * checks for an API key or Claude Code's own login and asks for a sign-in only when neither exists.
   */
  requireAccount?: boolean
  /** Text appended to Claude Code's system prompt for this launch (agent-facing toggles). */
  systemPromptAppend?: string
  /** The appended text for chats in a repository with its own "General preferences", by repo id. */
  systemPromptAppendByRepo?: Readonly<Record<string, string>>
  /** Claude Code `--settings` JSON for this launch ("Claude output style"). */
  settingsJson?: string
  /** `/add-dir` folders, by workspace path: the agent may read and edit them too. */
  linkedDirectories?: Readonly<Record<string, readonly string[]>>
  /** Workspace layout: the agent's proposed plans are saved to the workspace's `.context/plans`. */
  savesPlans?: boolean
  /** Workspace layout: what the chat learns about its repository's actions, read at each launch. */
  repoActionsInstruction?: (repoId: string | undefined) => string | null
}

export { STACKED_PULL_REQUESTS_INSTRUCTION } from '../native-chat/revio-agent-instructions'

/** Structured Claude runs a native local child, so use the host account selection. */
export function claudeStructuredAuthPolicyForSettings(
  settings: Partial<
    Pick<
      GlobalSettings,
      | 'claudeManagedAccounts'
      | 'activeClaudeManagedAccountId'
      | 'activeClaudeManagedAccountIdsByRuntime'
      | 'revioLayout'
      | 'revioStackedPullRequests'
      | 'revioGeneralPreferences'
      | 'revioRepoGeneralPreferences'
      | 'revioClaudeOutputStyle'
      | 'revioLinkedDirectories'
      | 'agentDefaultEnv'
      | 'revioClaudeAuth'
    >
  >
): ClaudeStructuredAuthPolicy {
  // Use the same fallback decision as terminals when the router is installed.
  const router = getClaudeProfileRouter()
  const managed = router
    ? router.routesToAccount()
    : isHostManagedClaudeAccount(
        settings.claudeManagedAccounts,
        getSelectedClaudeAccountIdForTarget(settings, { runtime: 'host' })
      )
  const instructions = revioAgentInstructions(settings)
  const byRepo = revioRepoAgentInstructions(settings)
  const settingsJson = claudeOutputStyleSettings(settings)
  return {
    account: managed ? 'managed' : 'system',
    // Bedrock and Vertex sign in through the person's cloud credentials, not an Orca account.
    ...(settings.revioLayout === true &&
    !isOrcaCloudSandboxHost() &&
    claudeProviderFromSettings(settings) === 'subscription'
      ? { requireAccount: true }
      : {}),
    ...(instructions ? { systemPromptAppend: instructions } : {}),
    ...(byRepo ? { systemPromptAppendByRepo: byRepo } : {}),
    ...(settingsJson ? { settingsJson } : {}),
    ...(settings.revioLayout === true ? { savesPlans: true } : {}),
    ...(settings.revioLayout === true && settings.revioLinkedDirectories
      ? { linkedDirectories: settings.revioLinkedDirectories }
      : {})
  }
}

/** Claude Code's own system prompt, plus this launch's appended instructions when there are any. */
/** The folders `/add-dir` linked to the workspace this chat runs in. */
export function claudeLinkedDirectories(
  policy: Pick<ClaudeStructuredAuthPolicy, 'linkedDirectories'>,
  cwd: string
): string[] {
  return [...(policy.linkedDirectories?.[cwd] ?? [])]
}

/** The `--settings` flag carrying this launch's output style, when one is chosen. */
export function claudeSettingsExtraArgs(
  policy: Pick<ClaudeStructuredAuthPolicy, 'settingsJson'>
): Record<string, string> {
  return policy.settingsJson ? { settings: policy.settingsJson } : {}
}

export function claudeSystemPromptOptions(
  policy: Pick<
    ClaudeStructuredAuthPolicy,
    'systemPromptAppend' | 'systemPromptAppendByRepo' | 'repoActionsInstruction'
  >,
  /** The chat's repository: its own "General preferences" replace the global ones. */
  repoId?: string
): { systemPrompt?: { type: 'preset'; preset: 'claude_code'; append: string } } {
  const preferences =
    (repoId ? policy.systemPromptAppendByRepo?.[repoId] : undefined) ?? policy.systemPromptAppend
  const append = [preferences, policy.repoActionsInstruction?.(repoId)].filter(Boolean).join('\n\n')
  return append ? { systemPrompt: { type: 'preset', preset: 'claude_code', append } } : {}
}
