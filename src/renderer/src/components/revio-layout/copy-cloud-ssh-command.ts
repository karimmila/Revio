import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cloudEnvironmentIdOf } from '@/lib/cloud-desktop'

/** "Copy SSH command" for a cloud workspace whose sandbox is running. */
export async function copyCloudSshCommand(worktreeId: string): Promise<void> {
  const environmentId = cloudEnvironmentIdOf(worktreeId)
  const api = window.api.cloud
  if (!environmentId || !api) {
    return
  }
  try {
    window.api.ui.writeClipboardText(await api.sshCommand(environmentId))
    toast.success(translate('auto.components.revioLayout.copiedSshCommand', 'Copied SSH command'))
  } catch (error) {
    toast.error(
      translate('auto.components.revioLayout.sshCommandCopyFailed', 'Failed to copy SSH command'),
      { description: error instanceof Error ? error.message : String(error) }
    )
  }
}
