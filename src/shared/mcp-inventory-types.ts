export type McpAgent = 'claude' | 'codex'

/** One MCP server an agent is configured with at user scope. */
export type McpServerEntry = {
  name: string
  agent: McpAgent
  /** stdio servers run `command args`; http servers connect to `url`. */
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
}

export type McpServerSpec = Omit<McpServerEntry, 'agent'>
