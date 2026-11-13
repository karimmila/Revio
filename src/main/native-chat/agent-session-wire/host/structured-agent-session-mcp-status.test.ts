import { expect, it, vi } from 'vitest'
import { readStructuredAgentMcpStatus } from './structured-agent-session-mcp-status'

function deps(readMcpStatus?: () => Promise<{ name: string; status: 'connected' }[] | null>) {
  return {
    agents: {
      registration: (agent: string) =>
        agent === 'claude' ? { adapter: { readMcpStatus } } : { adapter: {} }
    },
    adapter: { readMcpStatus }
  }
}

it('answers unsupported, not-running or the servers', async () => {
  const read = vi.fn(async (): Promise<{ name: string; status: 'connected' }[] | null> => [
    { name: 'github', status: 'connected' }
  ])
  const claude = deps(read)
  expect(await readStructuredAgentMcpStatus(claude, 'codex', 's1')).toEqual({ kind: 'unsupported' })
  expect(await readStructuredAgentMcpStatus(claude, 'claude', 's1')).toEqual({
    kind: 'servers',
    servers: [{ name: 'github', status: 'connected' }]
  })
  read.mockResolvedValueOnce(null)
  expect(await readStructuredAgentMcpStatus(claude, 'claude', 's1')).toEqual({
    kind: 'not-running'
  })
})
