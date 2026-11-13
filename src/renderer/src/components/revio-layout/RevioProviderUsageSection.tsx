import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  revioUsageEmptyState,
  revioUsageHeading,
  revioUsageRows,
  revioUsageProvider,
  revioUsageWarning,
  type RevioUsageProvider
} from './revio-provider-usage'

/** The account usage block under the context breakdown: windows left, resets, near-limit warning. */
export function RevioProviderUsageSection({
  provider
}: {
  provider: RevioUsageProvider
}): React.JSX.Element {
  const limits = useAppStore((s) => s.rateLimits[provider])
  // The card mounts on each open, so its clock is the moment it opened.
  const [openedAt] = useState(Date.now)
  const rows = revioUsageRows(provider, limits, openedAt)
  const loading = limits?.status === 'fetching'
  return (
    <div
      className="mt-3 space-y-2 border-t border-border/50 pt-3 text-xs"
      data-revio-provider-usage={provider}
    >
      <div className="text-sm font-semibold text-foreground">{revioUsageHeading(provider)}</div>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="space-y-1"
              data-revio-usage-low={row.low ? 'true' : undefined}
            >
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="revio-usage-left font-medium tabular-nums">
                  {translate('components.revio.usage.left', '{{percent}}% left', {
                    percent: row.remainingPercent.toFixed(0)
                  })}
                </span>
              </div>
              <Progress
                value={row.remainingPercent}
                aria-label={row.label}
                className="h-1.5"
                data-revio-usage-low={row.low ? 'true' : undefined}
              />
              <div className="text-2xs text-muted-foreground">{row.resets}</div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {translate('components.revio.usage.loading', 'Loading usage…')}
        </div>
      ) : (
        <p className="text-muted-foreground">{revioUsageEmptyState(provider)}</p>
      )}
      {rows.some((row) => row.low) ? (
        <p className="revio-usage-warning" role="status">
          {revioUsageWarning(provider)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The usage block for the context card, shown only in the workspace layout for Claude and Codex
 * chats.
 */
export function revioUsageFooter(
  revioLayout: boolean,
  agent: string | undefined
): React.JSX.Element | null {
  const provider = revioUsageProvider(agent)
  return revioLayout && provider ? <RevioProviderUsageSection provider={provider} /> : null
}
