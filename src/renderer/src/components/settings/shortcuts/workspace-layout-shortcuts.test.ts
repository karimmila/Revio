import { describe, expect, it } from 'vitest'
import { KEYBINDING_DEFINITIONS } from '../../../../../shared/keybindings/definitions'
import { isShortcutHiddenInWorkspaceLayout } from './workspace-layout-shortcuts'

describe('shortcuts listed in the workspace layout', () => {
  const listed = KEYBINDING_DEFINITIONS.map((definition) => definition.id).filter(
    (id) => !isShortcutHiddenInWorkspaceLayout(id)
  )

  it('lists no agent tabs, plugins, workspace board, emulator or quick commands', () => {
    expect(listed.filter((id) => id.startsWith('tab.newAgent'))).toEqual([])
    expect(listed).not.toContain('view.plugins')
    expect(listed).not.toContain('workspace.openBoard')
    expect(listed).not.toContain('tab.newSimulator')
    expect(listed).not.toContain('tab.openQuickCommandsMenu')
  })

  it('keeps the actions the layout uses', () => {
    expect(listed).toEqual(
      expect.arrayContaining(['workspace.create', 'worktree.palette', 'floatingTerminal.toggle'])
    )
  })
})
