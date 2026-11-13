// The chat commands the host serves:
// `agentSession.mcpStatus` ("MCP status") reads the chat's MCP servers from its live agent; Codex
// chats answer `unsupported`, a chat with no running agent `not-running`.
// `agentSession.restartAgent` (`/restart`) has the chat's next send start a fresh agent.

import { defineMethod } from '../../../core'
import { requireStructuredSessionHost } from '../creation/structured-agent-session-gate'
import {
  McpStatusParams,
  RestartAgentParams
} from '../../../../../../shared/rpc-contract/structured-agent-session-mcp-status-params'

export const STRUCTURED_AGENT_SESSION_MCP_STATUS_METHODS = [
  defineMethod({
    name: 'agentSession.mcpStatus',
    permission: 'workspace',
    params: McpStatusParams,
    handler: async (params, ctx) =>
      requireStructuredSessionHost(ctx, params.sessionId).mcpStatus(params.sessionId)
  }),
  defineMethod({
    name: 'agentSession.restartAgent',
    permission: 'workspace',
    params: RestartAgentParams,
    handler: async (params, ctx) =>
      requireStructuredSessionHost(ctx, params.sessionId).requestAgentRestart(params.sessionId)
  })
]
