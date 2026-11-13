import { describe, expect, it } from 'vitest'
import { cloudWorkspaceAgentLaunchRoute } from './cloud-agent-launch-route'

describe('cloudWorkspaceAgentLaunchRoute', () => {
  it('opens Claude and Codex as a chat when the person prefers chats', () => {
    const settings = { agentDefaultSurface: 'chat' as const }
    expect(cloudWorkspaceAgentLaunchRoute(settings, 'claude')).toBe('structured-native-chat')
    expect(cloudWorkspaceAgentLaunchRoute(settings, 'codex')).toBe('structured-native-chat')
  })

  it('follows a per-agent choice over the default surface', () => {
    expect(
      cloudWorkspaceAgentLaunchRoute(
        { agentDefaultSurface: 'chat', nativeChatProviders: { claude: false } },
        'claude'
      )
    ).toBe('terminal-tui')
    expect(
      cloudWorkspaceAgentLaunchRoute(
        { agentDefaultSurface: 'terminal', nativeChatProviders: { claude: true } },
        'claude'
      )
    ).toBe('structured-native-chat')
  })

  it('keeps agents without a structured session in the terminal', () => {
    expect(cloudWorkspaceAgentLaunchRoute({ agentDefaultSurface: 'chat' }, 'gemini')).toBe(
      'terminal-tui'
    )
  })
})
