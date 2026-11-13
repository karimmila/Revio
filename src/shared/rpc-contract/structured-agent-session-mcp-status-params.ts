// `agentSession.mcpStatus` reads the chat's MCP servers; `agentSession.restartAgent` (`/restart`)
// has its next send start a fresh agent.

import { z } from 'zod'
import { MutationEnvelope } from './structured-agent-session-mutation-envelope'
import { OptionsParams } from './structured-agent-session-params'

export const McpStatusParams = OptionsParams.strict()

export const RestartAgentParams = OptionsParams.strict()

/**
 * `agentSession.queuedMessagesPause`: the workspace layout's queue Pause, a mutation like Resume.
 */
export const QueuedMessagesPauseParams = z.object({ envelope: MutationEnvelope }).strict()
