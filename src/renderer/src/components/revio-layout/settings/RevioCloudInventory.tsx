import React from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import type { CloudInventory } from '../../../../../shared/cloud/cloud-types'
import { RevioSettingRow } from './RevioSettingsRows'

function sizeLabel(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`
}

function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

/**
 * What the Orca project on Vercel holds: each sandbox and the workspace that owns it (orphans can
 * be deleted), and the snapshots no build uses (deletable).
 */
export function RevioCloudInventory(): React.JSX.Element {
  const [inventory, setInventory] = React.useState<CloudInventory | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const load = React.useCallback(() => {
    setBusy(true)
    void window.api.cloud
      ?.inventory()
      .then((next) => {
        setInventory(next)
        setError(null)
      })
      .catch((reason: unknown) => setError(errorText(reason)))
      .finally(() => setBusy(false))
  }, [])
  React.useEffect(load, [load])
  const remove = (run: () => Promise<void> | undefined): void => {
    void run()
      ?.then(load)
      .catch((reason: unknown) => toast.error(errorText(reason)))
  }
  const confirm = useConfirmationDialog()
  // No workspace on this Mac owns an orphan, but another Mac on the same Vercel account may.
  const removeOrphan = (name: string): void => {
    void confirm({
      title: translate(
        'auto.components.revioLayout.settings.orphanDeleteTitle',
        'Delete sandbox {{value0}}?',
        { value0: name }
      ),
      description: translate(
        'auto.components.revioLayout.settings.orphanDeleteBody',
        'This sandbox was not created by this Mac. It may belong to another Mac that uses the same Vercel account. Delete it anyway?'
      ),
      confirmLabel: translate('auto.components.revioLayout.deleteArchivedConfirm', 'Delete'),
      confirmVariant: 'destructive',
      cancelLabel: translate('auto.components.revioLayout.restoreCancel', 'Cancel')
    }).then((confirmed) => {
      if (confirmed) {
        remove(() => window.api.cloud?.deleteSandbox(name))
      }
    })
  }
  const sandboxes = inventory?.sandboxes ?? []
  const unused = (inventory?.snapshots ?? []).filter((snapshot) => !snapshot.referenced)
  return (
    <>
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.cloudSandboxes', 'Sandboxes')}
        description={
          error ??
          (!inventory
            ? translate('auto.components.revioLayout.settings.checking', 'Checking…')
            : sandboxes.length === 0
              ? translate('auto.components.revioLayout.settings.cloudNoSandboxes', 'None')
              : undefined)
        }
        control={
          <button type="button" data-revio-settings-text-button="" disabled={busy} onClick={load}>
            <RefreshCw className="size-3.5" />
            {translate('auto.components.revioLayout.settings.refresh', 'Refresh')}
          </button>
        }
        below={
          sandboxes.length > 0 ? (
            <div className="flex flex-col gap-1">
              {sandboxes.map((sandbox) => (
                <div
                  key={sandbox.name}
                  data-revio-inventory-row=""
                  className="flex items-center gap-2 text-[12px]"
                >
                  <code className="min-w-0 flex-1 truncate">{sandbox.name}</code>
                  <span className="text-muted-foreground">{sandbox.status}</span>
                  <span className={sandbox.orphan ? 'text-destructive' : 'text-muted-foreground'}>
                    {sandbox.owner ??
                      (sandbox.orphan
                        ? translate('auto.components.revioLayout.settings.orphan', 'Orphan')
                        : translate('auto.components.revioLayout.settings.building', 'Building'))}
                  </span>
                  {sandbox.orphan ? (
                    <button
                      type="button"
                      data-revio-icon-button=""
                      aria-label={translate(
                        'auto.components.revioLayout.settings.envRemove',
                        'Remove'
                      )}
                      onClick={() => removeOrphan(sandbox.name)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : undefined
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.cloudSnapshots', 'Unused snapshots')}
        description={translate(
          'auto.components.revioLayout.settings.cloudSnapshotsDescription',
          'Snapshots no repository build starts from, such as the ones Vercel keeps when a sandbox stops. They count toward storage.'
        )}
        below={
          unused.length > 0 ? (
            <div className="flex flex-col gap-1">
              {unused.map((snapshot) => (
                <div
                  key={snapshot.id}
                  data-revio-inventory-row=""
                  className="flex items-center gap-2 text-[12px]"
                >
                  <code className="min-w-0 flex-1 truncate">{snapshot.id}</code>
                  <span className="text-muted-foreground">
                    {sizeLabel(snapshot.sizeBytes)} ·{' '}
                    {new Date(snapshot.createdAt).toLocaleDateString(getIntlLocale())}
                  </span>
                  <button
                    type="button"
                    data-revio-icon-button=""
                    aria-label={translate(
                      'auto.components.revioLayout.settings.envRemove',
                      'Remove'
                    )}
                    onClick={() => remove(() => window.api.cloud?.deleteSnapshot(snapshot.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : inventory ? (
            <div data-revio-inventory-empty="" className="text-[12px] text-muted-foreground">
              {translate(
                'auto.components.revioLayout.settings.cloudNoUnusedSnapshots',
                'No unused snapshots.'
              )}
            </div>
          ) : undefined
        }
      />
    </>
  )
}
