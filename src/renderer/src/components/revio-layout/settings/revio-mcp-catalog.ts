import type {
  McpAgent,
  McpServerEntry,
  McpServerSpec
} from '../../../../../shared/mcp-inventory-types'

/** Remote MCP servers worth offering; each signs in with OAuth inside the agent on first use. */
export const RECOMMENDED_MCP_SERVERS: readonly McpServerSpec[] = [
  { name: 'context7', transport: 'http', url: 'https://mcp.context7.com/mcp' },
  { name: 'linear', transport: 'http', url: 'https://mcp.linear.app/mcp' },
  { name: 'atlassian', transport: 'http', url: 'https://mcp.atlassian.com/v1/mcp' },
  { name: 'asana', transport: 'http', url: 'https://mcp.asana.com/sse' },
  { name: 'intercom', transport: 'http', url: 'https://mcp.intercom.com/mcp' },
  { name: 'microsoft-learn', transport: 'http', url: 'https://learn.microsoft.com/api/mcp' }
]

/** Datadog's MCP endpoint per site, as the "Connect Datadog" site picker. Site codes are
 * Datadog's own names, the same in every language. */
export const DATADOG_MCP_SITES = [
  { site: 'US1', url: 'https://mcp.datadoghq.com/v1/mcp' },
  { site: 'US3', url: 'https://mcp.us3.datadoghq.com/v1/mcp' },
  { site: 'US5', url: 'https://mcp.us5.datadoghq.com/v1/mcp' },
  { site: 'EU1', url: 'https://mcp.datadoghq.eu/v1/mcp' },
  { site: 'AP1', url: 'https://mcp.ap1.datadoghq.com/v1/mcp' },
  { site: 'AP2', url: 'https://mcp.ap2.datadoghq.com/v1/mcp' },
  { site: 'UK1', url: 'https://mcp.uk1.datadoghq.com/v1/mcp' }
] as const

export type DatadogSite = (typeof DATADOG_MCP_SITES)[number]['site']

export function datadogMcpSpec(site: DatadogSite): McpServerSpec {
  const url =
    DATADOG_MCP_SITES.find((entry) => entry.site === site)?.url ?? DATADOG_MCP_SITES[0].url
  return { name: 'datadog', transport: 'http', url }
}

export type McpServerRow = { spec: McpServerSpec; agents: McpAgent[] }

/** One row per server name, listing which agents already have it. */
export function groupMcpServers(entries: readonly McpServerEntry[]): McpServerRow[] {
  const rows = new Map<string, McpServerRow>()
  for (const { agent, ...spec } of entries) {
    const row = rows.get(spec.name) ?? { spec, agents: [] }
    if (!row.agents.includes(agent)) {
      row.agents.push(agent)
    }
    rows.set(spec.name, row)
  }
  return [...rows.values()].sort((a, b) => a.spec.name.localeCompare(b.spec.name))
}

export function matchesMcpSearch(spec: McpServerSpec, query: string): boolean {
  const haystack = `${spec.name} ${spec.url ?? ''} ${spec.command ?? ''}`.toLowerCase()
  return query.trim() === '' || haystack.includes(query.trim().toLowerCase())
}
