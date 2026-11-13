import type { KeybindingActionId } from '../../../../../shared/keybindings/types'

/**
 * Actions the workspace layout has no surface for: plugins, the workspace board, the mobile
 * emulator, markdown tabs, quick commands, nested workspaces and the floating panel's size.
 */
const NOT_IN_WORKSPACE_LAYOUT: ReadonlySet<string> = new Set<KeybindingActionId>([
  'view.plugins',
  'workspace.openBoard',
  'tab.newAgent',
  'tab.newSimulator',
  'tab.newMarkdown',
  'tab.openMarkdown',
  'tab.newBrowserSplitRight',
  'tab.openQuickCommandsMenu',
  'sidebar.childWorkspaces.toggle',
  'floatingWorkspace.maximize',
  'floatingWorkspace.minimize'
])

/** Also every "New <agent> tab": the workspace layout starts agents as chats from its own picker. */
export function isShortcutHiddenInWorkspaceLayout(actionId: string): boolean {
  return NOT_IN_WORKSPACE_LAYOUT.has(actionId) || actionId.startsWith('tab.newAgent.')
}
