import type React from 'react'
import { Cloud, Moon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { wakeAsleepCloudWorkspace } from '@/lib/asleep-cloud-wake'
import {
  dismissAsleepCloudConnectNotice,
  useAsleepCloudConnectNotice
} from '@/lib/asleep-cloud-connect-notice'
import { useAsleepCloudWorkspaces } from '@/lib/asleep-cloud-workspaces'
import type { AsleepCloudWorkspace } from '../../../../shared/asleep-cloud-workspace-types'
import { openCloudSettings } from './RevioLocationSwitcher'
import { formatRevioAgo } from './RevioWorkspaceHoverCard'

/**
 * The Cloud location's imported workspaces that have no sandbox yet, as the sidebar lists them:
 * Home used to show its empty state beside a sidebar that listed them.
 */
export function useHomeAsleepCloud(
  cloud: boolean,
  query: string,
  projectId: string
): readonly AsleepCloudWorkspace[] {
  const records = useAsleepCloudWorkspaces()
  if (!cloud) {
    return []
  }
  const needle = query.trim().toLowerCase()
  return records.filter(
    (record) =>
      (projectId === 'all' || record.repoId === projectId) &&
      (!needle ||
        record.displayName.toLowerCase().includes(needle) ||
        record.branch.toLowerCase().includes(needle))
  )
}

export function RevioHomeAsleepRows({
  records,
  repoNames,
  showRepo
}: {
  records: readonly AsleepCloudWorkspace[]
  repoNames: ReadonlyMap<string, string>
  showRepo: boolean
}): React.JSX.Element {
  return (
    <>
      {records.map((record) => {
        const lastActivity = record.lastActivityAt ? Date.parse(record.lastActivityAt) : Number.NaN
        return (
          <button
            key={record.id}
            type="button"
            data-revio-home-asleep-cloud={record.id}
            title={translate('auto.components.revioLayout.asleepCloudOpen', 'Open to wake it')}
            onClick={() => void wakeAsleepCloudWorkspace(record)}
            className="flex h-10 w-full cursor-default items-center gap-3 border-b border-border pr-4 pl-4 text-left text-[12px] text-foreground/75 transition-colors outline-none hover:bg-accent/40 hover:text-foreground focus-visible:bg-accent/40"
          >
            <Moon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{record.displayName}</span>
            <Cloud
              aria-label={translate(
                'auto.components.revioLayout.cloudWorkspace',
                'Cloud workspace'
              )}
              className="size-3 shrink-0 text-muted-foreground"
            />
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Number.isFinite(lastActivity) ? formatRevioAgo(lastActivity) : null}
            </span>
            {showRepo ? (
              <span className="w-40 shrink-0 truncate text-muted-foreground">
                {repoNames.get(record.repoId) ?? ''}
              </span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

/** Why an imported cloud workspace did not open, and the one step that lets it. */
export function RevioHomeConnectCard(): React.JSX.Element | null {
  const record = useAsleepCloudConnectNotice()
  if (!record) {
    return null
  }
  return (
    <div
      role="status"
      data-revio-home-connect-vercel=""
      className="m-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-accent/30 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">
          {translate(
            'auto.components.revioLayout.connectVercelToOpen',
            'Connect Vercel to open this imported cloud workspace'
          )}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {translate(
            'auto.components.revioLayout.connectVercelToOpenDetail',
            '{{value0}} runs in a sandbox on your Vercel account. Its changes and chats stay saved on this Mac until then.',
            { value0: record.displayName }
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openCloudSettings('cloud')}
        className="flex h-7 shrink-0 items-center rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-opacity hover:opacity-90"
      >
        {translate('auto.components.revioLayout.connectVercel', 'Connect Vercel')}
      </button>
      <button
        type="button"
        onClick={dismissAsleepCloudConnectNotice}
        className="flex h-7 shrink-0 items-center rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {translate('auto.components.revioLayout.dismiss', 'Dismiss')}
      </button>
    </div>
  )
}
