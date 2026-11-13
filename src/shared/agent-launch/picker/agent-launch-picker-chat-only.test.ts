import { describe, expect, it } from 'vitest'
import type { TuiAgent } from '../catalog/tui-agent'
import { buildNewTabAgentMenuRows } from './agent-launch-picker-rows'

const chatAgents: TuiAgent[] = ['claude', 'codex', 'grok', 'opencode']
const installed: TuiAgent[] = ['claude', 'claude-agent-teams', 'grok', 'gemini']

function rows(chatOnly: boolean, agentDefaultSurface: 'chat' | 'terminal' = 'chat') {
  return buildNewTabAgentMenuRows({
    settings: { agentDefaultSurface },
    detectedOnHost: installed,
    chatAgents,
    hostChatAnswer: () => 'yes',
    chatProgram: (agent) => (installed.includes(agent) ? 'available' : 'missing'),
    chatOnly
  }).map((row) => `${row.kind}:${row.agent}`)
}

describe('agent picker rows in the workspace layout', () => {
  it('lists chats only: no terminal agents, and a missing agent only when it is Claude or Codex', () => {
    expect(rows(true)).toEqual(['chat:claude', 'chat:grok', 'chat-unavailable:codex'])
  })

  it('keeps terminal agents and every missing chat in the classic layout', () => {
    expect(rows(false)).toEqual([
      'chat:claude',
      'chat:grok',
      'chat-unavailable:codex',
      'chat-unavailable:opencode',
      'cli:claude-agent-teams',
      'cli:gemini'
    ])
  })

  it('still lists chats for a profile whose saved surface is the terminal', () => {
    expect(rows(true, 'terminal')).toEqual(['chat:claude', 'chat:grok', 'chat-unavailable:codex'])
  })

  it('offers an agent the app could install only once it is installed, as Settings shows it', () => {
    const build = (chatOnly: boolean, antigravity: 'installable' | 'available'): string[] =>
      buildNewTabAgentMenuRows({
        settings: { agentDefaultSurface: 'chat' },
        detectedOnHost: ['claude'],
        chatAgents: ['claude', 'codex', 'antigravity'],
        hostChatAnswer: () => 'yes',
        chatProgram: (agent) =>
          agent === 'claude' ? 'available' : agent === 'antigravity' ? antigravity : 'missing',
        chatOnly
      }).map((row) => `${row.kind}:${row.agent}`)

    expect(build(true, 'installable')).toEqual(['chat:claude', 'chat-unavailable:codex'])
    expect(build(true, 'available')).toEqual([
      'chat:claude',
      'chat:antigravity',
      'chat-unavailable:codex'
    ])
    // The classic layout installs on first use, so it keeps offering the agent.
    expect(build(false, 'installable')).toContain('chat:antigravity')
  })
})
