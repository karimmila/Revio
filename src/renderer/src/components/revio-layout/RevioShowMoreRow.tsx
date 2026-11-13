import type React from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { translate } from '@/i18n/i18n'
import { getVirtualRowTransform } from '@/components/sidebar/worktree-list/viewport/virtual-rows'
import type { ShowMoreRow } from '../../../../shared/sidebar-list/section-show-more'
import { expandSidebarSection } from './revio-show-more'

/** "Show more" row at the end of a long sidebar section. */
export function renderShowMoreVirtualRow({
  row,
  vItem,
  measureVirtualRowElement
}: {
  row: ShowMoreRow
  vItem: VirtualItem
  measureVirtualRowElement: (element: HTMLDivElement | null) => void
}): React.JSX.Element {
  return (
    <div
      key={vItem.key}
      role="presentation"
      data-worktree-virtual-row
      data-worktree-virtual-row-key={String(vItem.key)}
      data-worktree-virtual-row-start={vItem.start}
      data-index={vItem.index}
      ref={measureVirtualRowElement}
      className="absolute left-0 right-0 top-0 px-2"
      style={{ transform: getVirtualRowTransform(vItem.start) }}
    >
      <button
        type="button"
        onClick={() => expandSidebarSection(row.sectionKey)}
        className="flex h-[24px] w-full items-center rounded-md px-2 text-left text-[12px] text-worktree-sidebar-foreground/55 transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-worktree-sidebar-foreground"
      >
        {translate('auto.components.revioLayout.showMore', 'Show more')}
        <span className="ml-1.5 tabular-nums">{row.hiddenCount}</span>
      </button>
    </div>
  )
}
