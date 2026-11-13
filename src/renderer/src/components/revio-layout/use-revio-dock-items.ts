import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TabBarItem } from '@/components/tab-bar/tab-bar-item-model'
import { isDockTabForWorkspace, useDockTerminalOwners } from './revio-dock-terminals'
import { orderDockTabs } from './revio-dock-order'
import { useRevioLayout } from './revio-layout'

/** In the dock, the tab strip lists only the active workspace's terminals. */
export function useRevioDockItems(worktreeId: string, items: readonly TabBarItem[]): TabBarItem[] {
  const revioLayout = useRevioLayout()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const owners = useDockTerminalOwners()
  const isDock = revioLayout && worktreeId === FLOATING_TERMINAL_WORKTREE_ID
  return useMemo(
    () =>
      isDock
        ? orderDockTabs(
            items.filter(
              (item) =>
                item.type === 'terminal' &&
                isDockTabForWorkspace(item.data.id, activeWorktreeId, owners)
            ),
            (item) => (item.type === 'terminal' ? item.data.customTitle : null)
          )
        : [...items],
    [activeWorktreeId, isDock, items, owners]
  )
}
