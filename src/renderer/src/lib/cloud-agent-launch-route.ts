import type { TuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
import { isAgentSessionHandleProvider } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle'
import {
  nativeChatPreferenceFor,
  type NativeChatDefaultSettings
} from '../../../shared/structured-native-chat-launch-route'
import type { AgentLaunchRoute } from './agent-session/launch/routing/agent-launch-routing'

/**
 * How a new cloud workspace's first agent opens. The sandbox does not exist when Create is
 * pressed, so the composer's host check answers "no chats" and picked the terminal TUI (live,
 * 2026-11-10: a Claude TUI tab plus an empty default chat on the sandbox's own model). The
 * sandbox runs the same Orca server as this Mac, so Claude and Codex follow the person's
 * Chat | CLI choice as on a Mac workspace; the host is still asked once it exists, and a "no"
 * opens the terminal (`declinedTerminal`), so nothing is lost when it cannot.
 */
export function cloudWorkspaceAgentLaunchRoute(
  settings: NativeChatDefaultSettings | null | undefined,
  agent: TuiAgent
): AgentLaunchRoute {
  return isAgentSessionHandleProvider(agent) && nativeChatPreferenceFor(settings, agent)
    ? 'structured-native-chat'
    : 'terminal-tui'
}
