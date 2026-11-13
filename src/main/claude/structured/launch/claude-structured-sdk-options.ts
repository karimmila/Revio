import type {
  Options as ClaudeAgentSdkOptions,
  PermissionMode
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentChatPermissionChoice,
  AgentChatPermissionMode
} from '../../../../shared/agent-launch/permissions/agent-chat-permission-mode'

export const CLAUDE_DEFAULT_SETTING_SOURCES = ['user', 'project', 'local'] as const

type ClaudePermissionOptions = Pick<ClaudeAgentSdkOptions, 'permissionMode' | 'extraArgs'> & {
  resolvePermissionModeInCli?: true
}

export type ClaudeStructuredSdkOptions = Pick<
  ClaudeAgentSdkOptions,
  | 'includePartialMessages'
  | 'systemPrompt'
  | 'settingSources'
  | 'supportedDialogKinds'
  | 'additionalDirectories'
  | 'plugins'
  | 'model'
  | 'effort'
  | 'allowDangerouslySkipPermissions'
  | 'settings'
  | 'sessionId'
  | 'resume'
  | 'resumeSessionAt'
  | 'forkSession'
> &
  ClaudePermissionOptions

/** Replay acknowledgements require an explicit flag; the SDK supplies the other transport flags. */
export const CLAUDE_STRUCTURED_BASE_OPTIONS: ClaudeStructuredSdkOptions = {
  includePartialMessages: true,
  // Keep the SDK on Claude Code's own system-prompt contract.
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  settingSources: [...CLAUDE_DEFAULT_SETTING_SOURCES],
  supportedDialogKinds: [],
  extraArgs: { 'replay-user-messages': null }
}

const CLAUDE_PERMISSION_MODES = {
  // Override settings defaultMode so the chat runs with its selected permission mode.
  ask: 'default',
  'accept-edits': 'acceptEdits',
  auto: 'auto'
} as const satisfies Record<Exclude<AgentChatPermissionMode, 'full-access'>, PermissionMode>

/** Full access is the owned CLI flag: the SDK's typed bypass emits a flag older binaries reject. */
export function claudeStructuredPermissionOptions(
  mode: AgentChatPermissionChoice
): ClaudePermissionOptions {
  if (mode === 'own') {
    // upstream request: https://github.com/anthropics/claude-agent-sdk-typescript/issues/519
    return { resolvePermissionModeInCli: true }
  }
  return mode === 'full-access'
    ? { extraArgs: { 'dangerously-skip-permissions': null } }
    : { permissionMode: CLAUDE_PERMISSION_MODES[mode] }
}
