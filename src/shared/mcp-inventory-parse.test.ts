import { describe, expect, it } from 'vitest'
import type { McpServerSpec } from './mcp-inventory-types'
import { mcpAddArgs, parseClaudeMcpServers, parseCodexMcpServers } from './mcp-inventory-parse'

describe('MCP inventory parsing', () => {
  it('reads Claude user-scope servers', () => {
    expect(
      parseClaudeMcpServers(
        JSON.stringify({
          mcpServers: {
            ctx: { type: 'http', url: 'https://mcp.context7.com/mcp' },
            fs: { command: 'npx', args: ['-y', 'fs-mcp'] },
            broken: 3
          }
        })
      )
    ).toEqual([
      { name: 'ctx', agent: 'claude', transport: 'http', url: 'https://mcp.context7.com/mcp' },
      { name: 'fs', agent: 'claude', transport: 'stdio', command: 'npx', args: ['-y', 'fs-mcp'] }
    ])
    expect(parseClaudeMcpServers('not json')).toEqual([])
    expect(parseClaudeMcpServers(JSON.stringify({ mcpServers: 'x' }))).toEqual([])
    expect(
      parseClaudeMcpServers(JSON.stringify({ mcpServers: { fs: { command: 'npx', args: 'bad' } } }))
    ).toEqual([{ name: 'fs', agent: 'claude', transport: 'stdio', command: 'npx', args: [] }])
  })

  it('reads Codex mcp_servers tables and skips nested ones', () => {
    const toml = [
      'model = "gpt-5"',
      '[mcp_servers.fs]',
      'command = "npx"',
      'args = ["-y", "fs-mcp"]',
      '[mcp_servers.fs.env]',
      'TOKEN = "x"',
      '[mcp_servers.linear]',
      'url = "https://mcp.linear.app/mcp"'
    ].join('\n')
    expect(parseCodexMcpServers(toml)).toEqual([
      { name: 'fs', agent: 'codex', transport: 'stdio', command: 'npx', args: ['-y', 'fs-mcp'] },
      { name: 'linear', agent: 'codex', transport: 'http', url: 'https://mcp.linear.app/mcp' }
    ])
  })

  it('builds the add commands for each agent', () => {
    const http: McpServerSpec = { name: 'ctx', transport: 'http', url: 'https://x/mcp' }
    const stdio: McpServerSpec = {
      name: 'fs',
      transport: 'stdio',
      command: 'npx',
      args: ['fs-mcp']
    }
    expect(mcpAddArgs('claude', http)).toEqual([
      'mcp',
      'add',
      '--scope',
      'user',
      '--transport',
      'http',
      'ctx',
      'https://x/mcp'
    ])
    expect(mcpAddArgs('codex', stdio)).toEqual(['mcp', 'add', 'fs', '--', 'npx', 'fs-mcp'])
  })
})
