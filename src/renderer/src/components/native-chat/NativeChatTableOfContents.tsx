import { useState } from 'react'
import { TableOfContents } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { NativeChatRailItem } from './native-chat-message-rail-items'

const SUMMARY_MAX = 60

/** The entry text: the message's start, cut at 60 characters. */
export function tableOfContentsSummary(
  item: Pick<NativeChatRailItem, 'text' | 'hasImages'>
): string {
  const text = item.text.trim()
  if (text === '/compact') {
    return translate('components.native-chat.toc.compacting', 'Compacting')
  }
  if (text.length > SUMMARY_MAX) {
    return `${text.slice(0, SUMMARY_MAX).trim()}...`
  }
  if (text.length > 0) {
    return text
  }
  return item.hasImages
    ? translate('components.native-chat.railImageMessage', 'Image attachment')
    : translate('components.native-chat.toc.empty', 'Empty message')
}

function centerInList(element: HTMLElement | null): void {
  const list = element?.parentElement
  if (element && list) {
    list.scrollTop = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2
  }
}

/** "Table of contents": hovering the button lists every message of the chat; a pick
 * scrolls to it. The rail beside it keeps its per-message ticks. */
export function NativeChatTableOfContents({
  items,
  activeId,
  onSelect
}: {
  items: readonly NativeChatRailItem[]
  activeId: string | null
  onSelect: (item: NativeChatRailItem) => void
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (items.length === 0) {
    return null
  }
  return (
    <div className="absolute top-4 right-2 z-40">
      <HoverCard open={open} onOpenChange={setOpen} openDelay={50} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            data-native-chat-toc
            aria-label={translate('components.native-chat.toc.label', 'Table of contents')}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TableOfContents className="size-4" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="left" align="start" sideOffset={-28} className="w-64">
          <div className="scrollbar-sleek flex max-h-80 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
            {items.map((item) => {
              const current = item.id === activeId
              return (
                <button
                  key={item.id}
                  ref={current ? centerInList : undefined}
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => {
                    onSelect(item)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                    current && 'bg-foreground/5'
                  )}
                >
                  {tableOfContentsSummary(item)}
                </button>
              )
            })}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
