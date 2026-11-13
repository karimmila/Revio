// "MCP status": the chat's MCP servers as its agent reports them.

export type AgentSessionMcpServerState =
  | 'connected'
  | 'failed'
  | 'needs-auth'
  | 'pending'
  | 'disabled'

export type AgentSessionMcpServer = {
  name: string
  status: AgentSessionMcpServerState | 'unknown'
  error?: string
  scope?: string
  toolCount?: number
}

/** `unsupported`: this chat's agent cannot report MCP status (Codex); `not-running`: no live agent. */
export type AgentSessionMcpStatusResult =
  | { kind: 'servers'; servers: AgentSessionMcpServer[] }
  | { kind: 'unsupported' }
  | { kind: 'not-running' }

const STATES: readonly AgentSessionMcpServerState[] = [
  'connected',
  'failed',
  'needs-auth',
  'pending',
  'disabled'
]

function state(value: string | undefined): AgentSessionMcpServer['status'] {
  return STATES.find((known) => known === value) ?? 'unknown'
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Reads an SDK `mcpServerStatus()` answer; entries without a name are dropped. */
export function readAgentSessionMcpServers(value: unknown): AgentSessionMcpServer[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }
    const record: Record<string, unknown> = { ...entry }
    const name = text(record.name)
    if (!name) {
      return []
    }
    const status = text(record.status)
    const error = text(record.error)
    const scope = text(record.scope)
    return [
      {
        name,
        status: state(status),
        ...(error ? { error } : {}),
        ...(scope ? { scope } : {}),
        ...(Array.isArray(record.tools) ? { toolCount: record.tools.length } : {})
      }
    ]
  })
}
