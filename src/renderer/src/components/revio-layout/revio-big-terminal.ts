import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { runQuickCommandInNewTab } from '@/lib/run-quick-command-in-new-tab'

/** The experimental Big terminal mode is on (⌘⇧T opens a terminal in the center). */
export function bigTerminalModeOn(): boolean {
  const settings = useAppStore.getState().settings
  return settings?.revioLayout === true && settings.revioBigTerminal === true
}

/**
 * ⌘⇧T with Big terminal mode: a terminal tab in the center pane beside the chats,
 * running the "New tab preset" command when one is set (Settings, Terminal).
 */
export function openRevioBigTerminal(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const preset = state.settings?.revioBigTerminalPreset?.trim() ?? ''
  const groupId =
    state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id
  if (!preset) {
    if (!groupId) {
      return false
    }
    void state.openNewTerminalTabInActiveWorkspace(groupId)
    return true
  }
  return (
    runQuickCommandInNewTab({
      command: {
        id: 'revio:big-terminal',
        label: translate('auto.components.revioLayout.bigTerminal', 'Terminal'),
        command: preset,
        appendEnter: true
      },
      worktreeId,
      groupId: groupId ?? null
    }) !== null
  )
}
