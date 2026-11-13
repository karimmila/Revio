import { describe, expect, it } from 'vitest'
import { CLAUDE_PLACEHOLDER_TOKEN } from '../../../shared/cloud/cloud-claude-placeholder'
import { getDefaultSettings } from '../../../shared/constants'
import { structuredLaunchSeedOptions } from '../../../shared/native-chat/input/native-chat-session-option-defaults'
import { newChatPermissionSettingsForHost } from './cloud-sandbox-chat-permission'

const fresh = getDefaultSettings('/home/user')

function newClaudeChatPermission(env: NodeJS.ProcessEnv, settings = fresh): string | undefined {
  return structuredLaunchSeedOptions(newChatPermissionSettingsForHost(settings, env), 'claude')
    ?.permissionMode
}

describe('new chat permission by host', () => {
  it('asks first on a Mac', () => {
    expect(newClaudeChatPermission({})).toBe('ask')
  })

  it('starts with full access inside a cloud sandbox', () => {
    expect(newClaudeChatPermission({ ORCA_CLOUD_SANDBOX: '1' })).toBe('full-access')
    expect(newClaudeChatPermission({ CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_PLACEHOLDER_TOKEN })).toBe(
      'full-access'
    )
  })

  it('keeps a permission someone chose for the sandbox', () => {
    const chosen = { ...fresh, agentPermissionOverrides: { claude: 'accept-edits' as const } }
    expect(newClaudeChatPermission({ ORCA_CLOUD_SANDBOX: '1' }, chosen)).toBe('accept-edits')
  })
})
