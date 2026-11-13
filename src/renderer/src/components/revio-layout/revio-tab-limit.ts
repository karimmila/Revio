import type { Tab } from '../../../../shared/tab-types'

/** The layout caps chat and terminal tabs per workspace at 5, or 10 with Tab Freak Mode; with
 * Split tabs on there is no cap. */
export const REVIO_TAB_LIMIT = 5
export const REVIO_TAB_FREAK_LIMIT = 10

export function revioTabLimit(settings: {
  revioTabFreakMode?: boolean
  revioSplitTabs?: boolean
}): number | null {
  if (settings.revioSplitTabs !== false) {
    return null
  }
  return settings.revioTabFreakMode === true ? REVIO_TAB_FREAK_LIMIT : REVIO_TAB_LIMIT
}

/** Whether one more chat or terminal tab would pass the cap; browser and file tabs do not count. */
export function revioTabLimitReached(
  tabs: readonly Pick<Tab, 'contentType'>[],
  limit: number | null
): boolean {
  return (
    limit !== null &&
    tabs.filter((tab) => tab.contentType === 'terminal' || tab.contentType === 'agent-session')
      .length >= limit
  )
}
