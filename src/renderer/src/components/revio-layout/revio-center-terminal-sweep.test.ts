import { describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { revioCenterTerminalTabIds } from './revio-center-terminal-sweep'

type Tab = { entityId: string; contentType: string; viewMode?: 'terminal' | 'chat' }

function tabs(byWorktree: Record<string, Tab[]>): Record<string, Tab[]> {
  return byWorktree
}

describe('revioCenterTerminalTabIds', () => {
  it('picks plain center terminals and leaves chats, browsers and the bottom panel', () => {
    const ids = revioCenterTerminalTabIds(
      tabs({
        'repo::/local': [
          { entityId: 'shell', contentType: 'terminal' },
          { entityId: 'shown-as-terminal', contentType: 'terminal', viewMode: 'terminal' },
          { entityId: 'pty-chat', contentType: 'terminal', viewMode: 'chat' },
          { entityId: 'chat', contentType: 'agent-session' },
          { entityId: 'web', contentType: 'browser' }
        ],
        [FLOATING_TERMINAL_WORKTREE_ID]: [{ entityId: 'dock-1', contentType: 'terminal' }]
      }),
      () => false
    )
    expect(ids).toEqual(['shell', 'shown-as-terminal'])
  })

  it('keeps the terminals of workspaces that still need center terminals', () => {
    const ids = revioCenterTerminalTabIds(
      tabs({
        'repo::/remote': [{ entityId: 'ssh-shell', contentType: 'terminal' }],
        'repo::/local': [{ entityId: 'shell', contentType: 'terminal' }]
      }),
      (worktreeId) => worktreeId === 'repo::/remote'
    )
    expect(ids).toEqual(['shell'])
  })
})
