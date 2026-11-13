import { translate } from '@/i18n/i18n'
import type { NativeChatMcpStatusShown } from './use-native-chat-mcp-status'

/** The MCP status list the `/mcp-status` dialog and the composer popover share. */
export function McpStatusBody({ shown }: { shown: NativeChatMcpStatusShown }): React.JSX.Element {
  const say = (text: string): React.JSX.Element => (
    <p className="text-sm text-muted-foreground">{text}</p>
  )
  switch (shown.kind) {
    case 'loading':
      return say(translate('components.native-chat.mcpStatus.loading', 'Loading MCP servers…'))
    case 'failed':
      return say(translate('components.native-chat.mcpStatus.failed', 'Could not read MCP status.'))
    case 'unsupported':
      return say(
        translate(
          'components.native-chat.mcpStatus.unsupported',
          "This chat's agent does not report MCP status."
        )
      )
    case 'not-running':
      return say(
        translate(
          'components.native-chat.mcpStatus.notRunning',
          'The agent is not running. Send a message, then check again.'
        )
      )
    case 'servers':
      return shown.servers.length === 0 ? (
        say(translate('components.native-chat.mcpStatus.none', 'No MCP servers are configured.'))
      ) : (
        <ul className="scrollbar-sleek flex max-h-80 flex-col divide-y divide-border overflow-y-auto text-sm">
          {shown.servers.map((server) => (
            <li key={server.name} className="flex flex-col gap-0.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{server.name}</span>
                {server.toolCount !== undefined ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {translate('components.native-chat.mcpStatus.tools', '{{count}} tools', {
                      count: server.toolCount,
                      defaultValue_one: '{{count}} tool'
                    })}
                  </span>
                ) : null}
                <span
                  data-mcp-status={server.status}
                  className="text-xs text-muted-foreground data-[mcp-status=connected]:text-foreground data-[mcp-status=failed]:text-destructive"
                >
                  {server.status}
                </span>
              </div>
              {server.error ? <p className="text-xs text-destructive">{server.error}</p> : null}
            </li>
          ))}
        </ul>
      )
  }
}
