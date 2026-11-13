import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { revioArchivesWithoutAsking } from '@/lib/revio-archive'
import type { ConfirmationDialogContextValue } from '@/components/confirmation-dialog-context'

/**
 * "Switch branch?": switching the workspace's branch under a running agent changes the
 * files it is working on, so ask first. Resolves true when the switch may go ahead.
 */
export async function confirmBranchSwitch(
  confirm: ConfirmationDialogContextValue,
  worktreePath: string,
  branch: string
): Promise<boolean> {
  const worktree = Object.values(selectWorktreesByRepo(useAppStore.getState()))
    .flat()
    .find((entry) => entry.path === worktreePath)
  if (!worktree || revioArchivesWithoutAsking(worktree.id)) {
    return true
  }
  return confirm({
    title: translate('auto.components.revioLayout.switchBranchTitle', 'Switch branch?'),
    description: translate(
      'auto.components.revioLayout.switchBranchDescription',
      "An agent is running in this workspace. Switching to {{value0}} will change the files it's working on.",
      { value0: branch }
    ),
    confirmLabel: translate('auto.components.revioLayout.switchAnyway', 'Switch anyway')
  })
}
