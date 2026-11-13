import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/index'
import { selectSettingUpWorktreeIdsKey, withSettingUpRowsFirst } from './revio-pending-rows'

// Smart sort ranks a brand-new workspace below older ones until its agent's first turn is
// attributed (seen 2026-11-12: about 6 s after the creation ended), so the row keeps its place a
// little longer than the creation lasts.
const SETTLE_MS = 20_000

function idsOf(key: string): string[] {
  return key ? key.split('\n') : []
}

/**
 * `withSettingUpRowsFirst` for the sidebar, holding a finished creation's row in place for
 * SETTLE_MS so it does not drop to its sorted spot and come back a few seconds later.
 */
export function useSettingUpRowsFirst(rankedIds: string[]): string[] {
  const settingUpKey = useAppStore(selectSettingUpWorktreeIdsKey)
  const [tracked, setTracked] = useState({ key: settingUpKey, settling: '' })
  if (tracked.key !== settingUpKey) {
    // Derived during render, so the frame that drops the creation already holds its row.
    const now = new Set(idsOf(settingUpKey))
    const ended = idsOf(tracked.key).filter((id) => !now.has(id))
    setTracked({
      key: settingUpKey,
      settling: [...idsOf(tracked.settling), ...ended].join('\n')
    })
  }
  useEffect(() => {
    if (!tracked.settling) {
      return
    }
    const timer = setTimeout(
      () => setTracked((current) => ({ ...current, settling: '' })),
      SETTLE_MS
    )
    return () => clearTimeout(timer)
  }, [tracked.settling])
  const firstKey = [...idsOf(settingUpKey), ...idsOf(tracked.settling)].join('\n')
  return useMemo(() => withSettingUpRowsFirst(rankedIds, firstKey), [rankedIds, firstKey])
}
