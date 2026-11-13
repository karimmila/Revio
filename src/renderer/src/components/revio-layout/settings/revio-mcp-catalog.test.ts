import { describe, expect, it } from 'vitest'
import { groupMcpServers, matchesMcpSearch, datadogMcpSpec } from './revio-mcp-catalog'

describe('MCP catalog', () => {
  it('groups one server name across agents', () => {
    const rows = groupMcpServers([
      { name: 'linear', agent: 'codex', transport: 'http', url: 'u' },
      { name: 'fs', agent: 'claude', transport: 'stdio', command: 'npx' },
      { name: 'linear', agent: 'claude', transport: 'http', url: 'u' }
    ])
    expect(rows.map((row) => [row.spec.name, row.agents])).toEqual([
      ['fs', ['claude']],
      ['linear', ['codex', 'claude']]
    ])
  })

  it('searches name, url and command', () => {
    expect(
      matchesMcpSearch({ name: 'ctx', transport: 'http', url: 'https://context7' }, 'CONTEXT')
    ).toBe(true)
    expect(matchesMcpSearch({ name: 'fs', transport: 'stdio', command: 'npx' }, 'linear')).toBe(
      false
    )
  })
})

it("points Datadog's MCP server at the chosen site", () => {
  expect(datadogMcpSpec('US1')).toEqual({
    name: 'datadog',
    transport: 'http',
    url: 'https://mcp.datadoghq.com/v1/mcp'
  })
  expect(datadogMcpSpec('EU1').url).toBe('https://mcp.datadoghq.eu/v1/mcp')
})
