import type { AgentSessionMcpStatusResult } from '../../../../shared/agent-session/agent-session-mcp-status'
import type { StructuredAgentSessionAdapter } from '../providers/structured-agent-session-adapter'

type McpReader = Pick<StructuredAgentSessionAdapter, 'readMcpStatus'>

/** `agentSession.mcpStatus`: the chat's MCP servers from its live agent. An agent whose adapter
 * cannot report them is `unsupported`; a chat with no running agent is `not-running`. */
export async function readStructuredAgentMcpStatus(
  deps: {
    adapter: McpReader
    agents: { registration: (agent: string) => { adapter: McpReader } | null }
  },
  agent: string | null,
  sessionId: string
): Promise<AgentSessionMcpStatusResult> {
  if (!agent || !deps.agents.registration(agent)?.adapter.readMcpStatus) {
    return { kind: 'unsupported' }
  }
  const servers = await deps.adapter.readMcpStatus?.(sessionId)
  return servers ? { kind: 'servers', servers } : { kind: 'not-running' }
}
