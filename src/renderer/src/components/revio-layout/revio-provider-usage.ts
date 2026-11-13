import { getIntlLocale, translate } from '@/i18n/i18n'
import type { ProviderRateLimits, RateLimitWindow } from '../../../../shared/rate-limit-types'

/** The workspace layout warns once any usage window has this much or less left. */
export const REVIO_USAGE_WARNING_REMAINING_PERCENT = 20

export type RevioUsageProvider = 'claude' | 'codex'

export type RevioUsageRow = {
  label: string
  remainingPercent: number
  low: boolean
  resets: string
}

/** Only Claude and Codex chats carry the account usage section in the context card. */
export function revioUsageProvider(agent: string | undefined): RevioUsageProvider | null {
  return agent === 'claude' || agent === 'codex' ? agent : null
}

export function revioUsageHeading(provider: RevioUsageProvider): string {
  return provider === 'claude'
    ? translate('components.revio.usage.claudeHeading', 'Claude usage')
    : translate('components.revio.usage.codexHeading', 'Codex usage')
}

export function revioUsageWarning(provider: RevioUsageProvider): string {
  return provider === 'claude'
    ? translate(
        'components.revio.usage.claudeWarning',
        'You’re approaching your Claude usage limit.'
      )
    : translate('components.revio.usage.codexWarning', 'You’re approaching your Codex usage limit.')
}

export function revioUsageEmptyState(provider: RevioUsageProvider): string {
  return provider === 'claude'
    ? translate(
        'components.revio.usage.claudeEmpty',
        'Usage data unavailable from provider. It refreshes after Claude responds.'
      )
    : translate(
        'components.revio.usage.codexEmpty',
        'Usage data unavailable from provider. It refreshes after Codex responds.'
      )
}

/** Names a window by its length ("5h limit", "7d limit"); a window without one keeps its role name. */
export function revioUsageWindowLabel(windowMinutes: number, fallback: string): string {
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
    return fallback
  }
  if (windowMinutes % 1440 === 0) {
    return translate('components.revio.usage.daysLimit', '{{count}}d limit', {
      count: windowMinutes / 1440
    })
  }
  if (windowMinutes % 60 === 0) {
    return translate('components.revio.usage.hoursLimit', '{{count}}h limit', {
      count: windowMinutes / 60
    })
  }
  return translate('components.revio.usage.minutesLimit', '{{count}}m limit', {
    count: windowMinutes
  })
}

function resetText(window: RateLimitWindow): string {
  const time =
    window.resetDescription ??
    (window.resetsAt === null
      ? null
      : new Date(window.resetsAt).toLocaleString(getIntlLocale(), {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit'
        }))
  return translate('components.revio.usage.resets', 'Resets {{time}}', {
    time: time ?? translate('components.revio.usage.resetUnknown', 'reset time unavailable')
  })
}

function fallbackLabels(provider: RevioUsageProvider): [string, string] {
  return provider === 'claude'
    ? [
        translate('components.revio.usage.fiveHourLimit', '5-hour limit'),
        translate('components.revio.usage.sevenDayLimit', '7-day limit')
      ]
    : [
        translate('components.revio.usage.primaryLimit', 'Primary limit'),
        translate('components.revio.usage.secondaryLimit', 'Secondary limit')
      ]
}

/** The session and weekly windows as remaining-percent rows, skipping windows that already reset. */
export function revioUsageRows(
  provider: RevioUsageProvider,
  limits: ProviderRateLimits | null,
  now: number
): RevioUsageRow[] {
  if (!limits) {
    return []
  }
  const [primaryFallback, secondaryFallback] = fallbackLabels(provider)
  const windows: [RateLimitWindow | null, string][] = [
    [limits.session, primaryFallback],
    [limits.weekly, secondaryFallback]
  ]
  return windows.flatMap(([window, fallback]) => {
    if (!window || (window.resetsAt !== null && window.resetsAt <= now)) {
      return []
    }
    const remainingPercent = Math.max(0, Math.min(100, 100 - window.usedPercent))
    return [
      {
        label: revioUsageWindowLabel(window.windowMinutes, fallback),
        remainingPercent,
        low: remainingPercent <= REVIO_USAGE_WARNING_REMAINING_PERCENT,
        resets: resetText(window)
      }
    ]
  })
}
