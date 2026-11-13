import { translate } from '@/i18n/i18n'

/** The bottom panel lists Setup, then Run, then the numbered terminals. */
export function orderDockTabs<T>(
  tabs: readonly T[],
  titleOf: (tab: T) => string | null | undefined
): T[] {
  const setupTitle = translate('auto.components.revioLayout.setupTab', 'Setup')
  const runTitle = translate('auto.lib.repoActionRun.runTab', 'Run')
  const rank = (tab: T): number => {
    const title = titleOf(tab)
    return title === setupTitle ? 0 : title === runTitle ? 1 : 2
  }
  return tabs
    .map((tab, position) => ({ tab, position, rank: rank(tab) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.tab)
}
