import type { KeybindingActionId, PlatformBindings } from './types'
import { platformBindings } from './definitions-support'

/**
 * The keymap (its 0.92 keybinding registry), as the default bindings of Orca's matching actions
 * while the workspace layout is on. Orca keys that the workspace layout gives to something else are
 * unbound here, so each chord does one thing; outside the layout Orca's own defaults stay. A user's
 * keybindings.json still wins over both.
 */
const REVIO_LAYOUT_DEFAULTS: Partial<Record<KeybindingActionId, PlatformBindings>> = {
  // ⌘K: the workspace layout's command palette; Orca's nearest is the workspace switcher.
  'worktree.palette': platformBindings(['Mod+K']),
  'terminal.clear': platformBindings([]),
  'app.settings': platformBindings(['Mod+Comma']),
  'sidebar.right.toggle': platformBindings(['Mod+Alt+B']),
  'tab.newBrowserSplitRight': platformBindings([]),
  // ⌘J: the terminal panel.
  'floatingTerminal.toggle': platformBindings(['Mod+J']),
  'workspace.delete': platformBindings(['Mod+Shift+A']),
  'editor.addReviewNote': platformBindings([]),
  'worktree.navigateUp': platformBindings(['Mod+Alt+ArrowUp']),
  'worktree.navigateDown': platformBindings(['Mod+Alt+ArrowDown']),
  // ⌘R runs the workspace's action, ⌘⇧R starts a review, ⌘E edits a file, ⌘L focuses the chat.
  'tab.rename': platformBindings([]),
  // ⌘⇧Y commit and push, ⌘⇧M merge, ⌘⇧G open the PR.
  'view.plugins': platformBindings([]),
  // ⌘⇧E toggles Fast mode in the chat.
  'sidebar.explorer.toggle': platformBindings([]),
  'tab.newMarkdown': platformBindings([]),
  'sidebar.sourceControl.toggle': platformBindings([]),
  // ⌘⇧D opens the diff view; ⌘D still splits.
  'terminal.splitDown': platformBindings([]),
  'app.forceReload': platformBindings([]),
  'voice.dictation': platformBindings(['Ctrl+Shift+D']),
  // ⌃Tab / ⌃⇧Tab and ⌘⌥→ / ⌘⌥← step through the tabs in order; the workspace
  // history back/forward that held ⌘⌥←/→ keeps no key here (the palette and ⌘⌥↑/↓ still move).
  'tab.nextAllTypes': platformBindings([
    'Mod+Shift+BracketRight',
    'Ctrl+Tab',
    'Mod+Alt+ArrowRight'
  ]),
  'tab.previousAllTypes': platformBindings([
    'Mod+Shift+BracketLeft',
    'Ctrl+Shift+Tab',
    'Mod+Alt+ArrowLeft'
  ]),
  'tab.previousRecent': platformBindings([]),
  // ⌘[ / ⌘] go back and forward through visited workspaces, as nav.back/forward.
  'worktree.history.back': platformBindings(['Mod+BracketLeft']),
  'worktree.history.forward': platformBindings(['Mod+BracketRight']),
  // Settings lane: ⌘⌥T toggles the theme, ⌘⇧O opens the Open in menu, ⌘Y toggles port forwarding.
  'tab.newAgent': platformBindings([]),
  // ⌘⇧N opens Create on its "Create from" picker (pull requests, branches, issues).
  'workspace.create': platformBindings(['Mod+N']),
  'tab.openMarkdown': platformBindings([]),
  // ⌘⇧B opens the workspace's localhost URL; new browser tabs come from the + menu.
  'tab.newBrowser': platformBindings([]),
  'sidebar.ports.toggle': { darwin: ['Mod+Y'], linux: [], win32: [] },
  // The mobile emulator is not part of the workspace layout, so its chord opens nothing.
  'tab.newSimulator': platformBindings([])
}

let revioLayoutKeymap = false

/** Returns true when the keymap changed, so callers rebuild menus and re-send bindings. */
export function setRevioLayoutKeymap(on: boolean): boolean {
  if (revioLayoutKeymap === on) {
    return false
  }
  revioLayoutKeymap = on
  return true
}

export function isRevioLayoutKeymap(): boolean {
  return revioLayoutKeymap
}

export function revioLayoutDefaultBindings(
  actionId: KeybindingActionId
): PlatformBindings | undefined {
  return revioLayoutKeymap ? REVIO_LAYOUT_DEFAULTS[actionId] : undefined
}
