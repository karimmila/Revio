import { translate } from '@/i18n/i18n'
import type { CmdJQuickAction } from './quick-actions'

/**
 * Upstream actions the workspace layout leaves out of search: markdown and terminal tabs, quick
 * commands and the split browser are not part of it, and it lists its own "Create workspace".
 */
const NOT_IN_WORKSPACE_LAYOUT = new Set([
  'new-markdown-file',
  'new-terminal-tab',
  'new-browser-tab-split-right',
  'create-workspace',
  'add-quick-command'
])

export function quickActionsForWorkspaceLayout(
  actions: readonly CmdJQuickAction[]
): CmdJQuickAction[] {
  return actions
    .filter((action) => !NOT_IN_WORKSPACE_LAYOUT.has(action.id))
    .map((action) =>
      action.id === 'delete-workspace'
        ? {
            ...action,
            title: translate('auto.components.cmd.j.revio.deleteWorkspace', 'Delete workspace'),
            description: translate(
              'auto.components.cmd.j.revio.deleteWorkspaceDescription',
              'Delete the current workspace.'
            )
          }
        : action
    )
}
