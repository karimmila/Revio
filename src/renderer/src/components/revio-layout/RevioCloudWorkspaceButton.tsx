import React from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useCloudMirror } from '@/lib/use-cloud-mirror'

function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function syncedAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) {
    return translate('auto.components.revioLayout.syncedSeconds', 'Synced {{value0}} s ago', {
      value0: seconds
    })
  }
  return translate('auto.components.revioLayout.syncedMinutes', 'Synced {{value0}} min ago', {
    value0: Math.round(seconds / 60)
  })
}

/**
 * The workspace layout shows a cloud workspace's details from its title: the environment and "Sync
 * to a local directory". This button holds the same: the toggle, a status line, the mirror's folder
 * and Sync now. The sync only ever copies from the sandbox to this Mac.
 */
export function RevioCloudWorkspaceButton({
  worktreeId,
  environmentId,
  className
}: {
  worktreeId: string
  environmentId: string
  className: string
}): React.JSX.Element {
  const { info, syncing, lastResult, syncNow, setEnabled } = useCloudMirror(
    worktreeId,
    environmentId
  )
  const now = useNow(5000)
  const status = syncing
    ? translate('auto.components.revioLayout.syncing', 'Syncing…')
    : info?.error
      ? info.error
      : info?.lastSyncedAt
        ? syncedAgo(info.lastSyncedAt, now)
        : translate('auto.components.revioLayout.notSynced', 'Not synced yet')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-revio-cloud-button=""
          aria-label={translate('auto.components.revioLayout.cloudWorkspace', 'Cloud workspace')}
          title={status}
          className={className}
        >
          {syncing ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : (
            <Cloud className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80">
        {/* PopoverContent has no padding of its own; p-3 matches the workspace title card beside it. */}
        <div data-revio-cloud-panel="" className="flex flex-col gap-3 p-3 text-[13px]">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{translate('auto.components.revioLayout.environment', 'Environment')}</span>
            <span className="text-foreground">
              {translate('auto.components.revioLayout.vercelSandbox', 'Vercel Sandbox')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>
              {translate('auto.components.revioLayout.syncToLocal', 'Sync to a local directory')}
            </span>
            <Switch
              checked={info?.enabled ?? false}
              onCheckedChange={setEnabled}
              aria-label={translate(
                'auto.components.revioLayout.syncToLocal',
                'Sync to a local directory'
              )}
            />
          </div>
          <div
            data-revio-mirror-status=""
            className={info?.error ? 'text-destructive' : 'text-muted-foreground'}
          >
            {status}
            {lastResult && !info?.error ? <div className="text-[12px]">{lastResult}</div> : null}
          </div>
          {info?.mirrorPath ? (
            <code
              className="truncate rounded-md bg-muted px-2 py-1 text-[12px]"
              title={info.mirrorPath}
            >
              {info.mirrorPath}
            </code>
          ) : null}
          <button
            type="button"
            data-revio-settings-button=""
            disabled={syncing}
            onClick={syncNow}
            className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-border text-[12px] hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" />
            {translate('auto.components.revioLayout.syncNow', 'Sync to Mac now')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
