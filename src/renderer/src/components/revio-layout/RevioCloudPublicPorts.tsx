import React from 'react'
import { Copy, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import type { CloudPublicPorts } from '../../../../shared/cloud/cloud-types'

function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

function cloudApi(): NonNullable<typeof window.api.cloud> {
  const api = window.api.cloud
  if (!api) {
    throw new Error('Cloud workspaces are not available in this window.')
  }
  return api
}

/**
 * "Share publicly" for a cloud workspace's ports. Nothing is shared until the person confirms a
 * port here; the list comes from Vercel's live routes each time the panel opens.
 */
export function RevioCloudPublicPorts({
  environmentId,
  isVisible
}: {
  environmentId: string
  isVisible: boolean
}): React.JSX.Element | null {
  const [state, setState] = React.useState<CloudPublicPorts | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    try {
      setState(await cloudApi().publicPorts(environmentId))
      setLoadError(null)
    } catch (error) {
      setLoadError(errorText(error))
    }
  }, [environmentId])

  React.useEffect(() => {
    if (isVisible) {
      void load()
    }
  }, [isVisible, load])

  const share = async (port: number): Promise<void> => {
    setBusy(port)
    try {
      await cloudApi().sharePort(environmentId, port)
      setConfirming(null)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
      await load()
    }
  }

  const disable = async (port: number): Promise<void> => {
    setBusy(port)
    try {
      await cloudApi().unsharePort(environmentId, port)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(null)
      await load()
    }
  }

  const copy = (url: string): void => {
    void window.api.ui.writeClipboardText(url)
    toast.success(translate('auto.components.revioLayout.publicPorts.copied', 'Link copied'))
  }

  if (loadError) {
    return (
      <div data-revio-public-ports="" className="border-t border-border px-3 py-2 text-xs">
        <div className="text-muted-foreground">{loadError}</div>
      </div>
    )
  }
  if (!state || (state.shared.length === 0 && state.listening.length === 0)) {
    return null
  }

  return (
    <div data-revio-public-ports="" className="border-t border-border px-3 py-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Globe className="size-3" />
        {translate('auto.components.revioLayout.publicPorts.title', 'Public links')}
      </div>
      {state.shared.map((entry) => (
        <div key={`shared-${entry.port}`} data-public-port={entry.port} className="py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground">:{entry.port}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {entry.url}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('auto.components.revioLayout.publicPorts.copy', 'Copy')}
              onClick={() => copy(entry.url)}
            >
              <Copy />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busy === entry.port}
              onClick={() => void disable(entry.port)}
            >
              {translate('auto.components.revioLayout.publicPorts.disable', 'Disable')}
            </Button>
          </div>
          <div className="text-[11px] text-status-warning-text">
            {translate(
              'auto.components.revioLayout.publicPorts.warning',
              'Anyone with this link can reach it.'
            )}
          </div>
        </div>
      ))}
      {state.listening.map((entry) =>
        confirming === entry.port ? (
          <div key={`confirm-${entry.port}`} data-public-port-confirm={entry.port} className="py-1">
            <div className="text-xs text-foreground">
              {translate(
                'auto.components.revioLayout.publicPorts.confirm',
                'Share port {{value0}} publicly? Anyone with the link can reach it until you disable it.',
                { value0: String(entry.port) }
              )}
            </div>
            <div className="mt-1 flex justify-end gap-1">
              <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(null)}>
                {translate('auto.components.revioLayout.publicPorts.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={busy === entry.port}
                onClick={() => void share(entry.port)}
              >
                {translate('auto.components.revioLayout.publicPorts.share', 'Share')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={`listening-${entry.port}`}
            data-public-port-candidate={entry.port}
            className="flex items-center gap-2 py-1"
          >
            <span className="text-xs text-foreground">:{entry.port}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {entry.loopbackOnly
                ? translate(
                    'auto.components.revioLayout.publicPorts.loopback',
                    'Listens on localhost only; the link may not reach it'
                  )
                : ''}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setConfirming(entry.port)}
            >
              {translate('auto.components.revioLayout.publicPorts.shareAction', 'Share publicly')}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
