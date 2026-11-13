import { expect, it } from 'vitest'
import { readAgentSessionMcpServers } from './agent-session-mcp-status'

it("reads the SDK's MCP server list", () => {
  expect(
    readAgentSessionMcpServers([
      { name: 'github', status: 'connected', scope: 'user', tools: [{ name: 'a' }, { name: 'b' }] },
      { name: 'db', status: 'failed', error: 'spawn ENOENT' },
      { name: 'odd', status: 'weird' },
      { status: 'connected' }
    ])
  ).toEqual([
    { name: 'github', status: 'connected', scope: 'user', toolCount: 2 },
    { name: 'db', status: 'failed', error: 'spawn ENOENT' },
    { name: 'odd', status: 'unknown' }
  ])
  expect(readAgentSessionMcpServers(null)).toEqual([])
})
