import { translate } from '@/i18n/i18n'

export function formatRevioAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes < 1) {
    return translate('auto.components.revioLayout.agoNow', 'now')
  }
  if (minutes < 60) {
    return translate('auto.components.revioLayout.agoMinutes', '{{value0}}m', {
      value0: minutes
    })
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return translate('auto.components.revioLayout.agoHours', '{{value0}}h', { value0: hours })
  }
  return translate('auto.components.revioLayout.agoDays', '{{value0}}d', {
    value0: Math.floor(hours / 24)
  })
}

/** "5m ago" in a sentence; under a minute reads "just now", never "now ago". */
export function formatRevioAgoPhrase(timestamp: number, now = Date.now()): string {
  return now - timestamp < 60_000
    ? translate('auto.components.revioLayout.agoJustNow', 'just now')
    : translate('auto.components.revioLayout.agoSuffix', '{{value0}} ago', {
        value0: formatRevioAgo(timestamp, now)
      })
}
