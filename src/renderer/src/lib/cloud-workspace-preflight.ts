import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { currentSnapshot } from '../../../shared/cloud/cloud-types'
import { openCloudSettings } from '@/components/revio-layout/RevioLocationSwitcher'
import { refreshCloudReadiness } from '@/lib/cloud-readiness'

/**
 * Checks what a cloud workspace needs before Orca starts a sandbox: a connected Vercel account
 * and a finished build of the repository. Throws with the fix, and offers a button to it.
 */
export async function assertCloudWorkspaceReady(repoId: string): Promise<void> {
  const status = await window.api.vercelCloud?.status()
  if (status?.state !== 'connected') {
    const message = translate(
      'auto.lib.cloudWorkspacePreflight.connectVercel',
      'Connect Vercel before creating a cloud workspace.'
    )
    toast.error(message, {
      action: {
        label: translate('auto.lib.cloudWorkspacePreflight.openCloud', 'Open Cloud settings'),
        onClick: () => openCloudSettings('cloud')
      }
    })
    throw new Error(message)
  }
  const state = await window.api.cloud?.repoState(repoId)
  if (!state || !currentSnapshot(state)) {
    const message = translate(
      'auto.lib.cloudWorkspacePreflight.buildFirst',
      'Build this repository for the cloud first. Cloud workspaces start from its build.'
    )
    toast.error(message, {
      action: {
        label: translate('auto.lib.cloudWorkspacePreflight.openRepo', 'Open repository settings'),
        onClick: () => openCloudSettings(`repo:${repoId}`)
      }
    })
    throw new Error(message)
  }
  // Orca's record can outlive the snapshot: Vercel expires or deletes them on its own.
  const check = await window.api.cloud?.checkBuild?.(repoId).catch(() => 'ready' as const)
  if (check === 'expired') {
    void refreshCloudReadiness()
    const message = translate(
      'auto.lib.cloudWorkspacePreflight.buildExpired',
      'Vercel no longer has this repository’s cloud build. Rebuild it, then press Create again.'
    )
    toast.error(message, {
      action: {
        label: translate('auto.lib.cloudWorkspacePreflight.rebuild', 'Rebuild'),
        onClick: () => void rebuildForCloud(repoId)
      }
    })
    throw new Error(message)
  }
}

/** Starts the build right here; the composer's readiness line follows it until it is done. */
async function rebuildForCloud(repoId: string): Promise<void> {
  try {
    await window.api.cloud?.startBuild(repoId)
    void refreshCloudReadiness()
    toast.message(
      translate(
        'auto.lib.cloudWorkspacePreflight.rebuilding',
        'Rebuilding for the cloud. Create works again once the build finishes.'
      ),
      {
        action: {
          label: translate('auto.lib.cloudWorkspacePreflight.showBuild', 'Show build'),
          onClick: () => openCloudSettings(`repo:${repoId}`)
        }
      }
    )
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}
