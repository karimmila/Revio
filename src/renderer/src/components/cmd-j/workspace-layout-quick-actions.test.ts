import { describe, expect, it } from 'vitest'
import { getCmdJQuickActions } from './quick-actions'
import { quickActionsForWorkspaceLayout } from './workspace-layout-quick-actions'

describe('search actions in the workspace layout', () => {
  it('offers no markdown, terminal-tab, quick-command or worktree actions', () => {
    const actions = quickActionsForWorkspaceLayout(getCmdJQuickActions())
    const ids = actions.map((action) => action.id)

    expect(ids).toContain('new-browser-tab')
    expect(ids).not.toContain('new-markdown-file')
    expect(ids).not.toContain('new-terminal-tab')
    expect(ids).not.toContain('add-quick-command')
    expect(ids).not.toContain('create-workspace')
    expect(actions.find((action) => action.id === 'delete-workspace')?.title).toBe(
      'Delete workspace'
    )
  })
})
