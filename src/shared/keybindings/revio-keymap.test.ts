import { afterEach, describe, expect, it } from 'vitest'
import { KEYBINDING_DEFINITIONS } from './definitions'
import { getEffectiveKeybindingsForAction } from './effective'
import { findKeybindingConflicts } from './formatting'
import { setRevioLayoutKeymap } from './revio-keymap'

afterEach(() => {
  setRevioLayoutKeymap(false)
})

describe('Workspace layout keymap', () => {
  it("gives the layout's chords to the matching actions and frees the colliding ones", () => {
    setRevioLayoutKeymap(true)
    const keys = (id: Parameters<typeof getEffectiveKeybindingsForAction>[0]) =>
      getEffectiveKeybindingsForAction(id, 'darwin')
    expect(keys('worktree.palette')).toEqual(['Mod+K'])
    expect(keys('floatingTerminal.toggle')).toEqual(['Mod+J'])
    expect(keys('sidebar.right.toggle')).toEqual(['Mod+Alt+B'])
    expect(keys('workspace.delete')).toEqual(['Mod+Shift+A'])
    expect(keys('app.settings')).toEqual(['Mod+Comma'])
    expect(keys('tab.rename')).toEqual([])
    expect(keys('app.forceReload')).toEqual([])
    expect(keys('voice.dictation')).toEqual(['Ctrl+Shift+D'])
    expect(keys('terminal.splitDown')).toEqual([])
    expect(keys('view.plugins')).toEqual([])
    expect(keys('sidebar.explorer.toggle')).toEqual([])
    expect(keys('tab.newMarkdown')).toEqual([])
    expect(keys('tab.openMarkdown')).toEqual([])
    expect(keys('tab.newBrowser')).toEqual([])
    expect(keys('sidebar.sourceControl.toggle')).toEqual([])
    expect(keys('tab.nextAllTypes')).toEqual(
      expect.arrayContaining(['Ctrl+Tab', 'Mod+Alt+ArrowRight'])
    )
    expect(keys('tab.previousAllTypes')).toEqual(
      expect.arrayContaining(['Ctrl+Shift+Tab', 'Mod+Alt+ArrowLeft'])
    )
    expect(keys('worktree.history.back')).toEqual(['Mod+BracketLeft'])
    expect(keys('worktree.history.forward')).toEqual(['Mod+BracketRight'])
    expect(keys('workspace.create')).toEqual(['Mod+N'])
    expect(keys('tab.newAgent')).toEqual([])
    expect(keys('tab.newSimulator')).toEqual([])
    expect(keys('tab.openMarkdown')).toEqual([])
    expect(keys('tab.newBrowser')).toEqual([])
    expect(keys('sidebar.ports.toggle')).toEqual(['Mod+Y'])
  })

  it("keeps Orca's own defaults outside the layout", () => {
    expect(getEffectiveKeybindingsForAction('worktree.palette', 'darwin')).toEqual(['Mod+J'])
    expect(getEffectiveKeybindingsForAction('workspace.delete', 'darwin')).not.toContain(
      'Mod+Shift+A'
    )
  })

  it('has no conflicting defaults on any platform', () => {
    setRevioLayoutKeymap(true)
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(
        findKeybindingConflicts(platform, undefined, {
          relevantActionIds: KEYBINDING_DEFINITIONS.map((definition) => definition.id)
        })
      ).toEqual([])
    }
  })
})
