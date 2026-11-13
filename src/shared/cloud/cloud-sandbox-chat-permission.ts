import type { GlobalSettings } from '../global-settings-types'

type ChatPermissionSettings = Partial<
  Pick<
    GlobalSettings,
    'agentPermissionDefault' | 'agentPermissionOverrides' | 'nativeChatPermissionMode'
  >
>

/**
 * New chats ask before they act on a Mac. A cloud sandbox is itself the isolation boundary and
 * nobody watches its prompts, so there an untouched "ask" default becomes full access. A choice
 * made for one agent, or any other default, is kept as it is.
 */
export function cloudSandboxChatPermissionSettings<T extends ChatPermissionSettings>(
  settings: T
): T {
  if (
    settings.agentPermissionDefault !== 'ask' ||
    Object.keys(settings.agentPermissionOverrides ?? {}).length > 0
  ) {
    return settings
  }
  return {
    ...settings,
    agentPermissionDefault: 'full-access',
    nativeChatPermissionMode: 'full-access'
  }
}
