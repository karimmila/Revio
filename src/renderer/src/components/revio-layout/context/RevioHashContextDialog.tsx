import { useEffect, useState } from 'react'
import { GitPullRequest, CircleDot } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type { GitHubWorkItem } from '../../../../../shared/github/work-item-types'
import { REVIO_HASH_CONTEXT_EVENT, insertWorkItemContext } from './revio-hash-context'
import { readWorkItemDetails, searchWorkItems } from './revio-hash-context-search'
import { attachWorkItemContext } from './revio-hash-context-attach'

/** `#`: pick an open PR or issue of this workspace's repository; its number, title and
 * link replace the `#` in the chat input, and its content follows as a text attachment. */
export function RevioHashContextDialog(): React.JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<readonly GitHubWorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const open = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail instanceof HTMLElement) {
        setTarget(event.detail)
        setQuery('')
        setActive(0)
      }
    }
    window.addEventListener(REVIO_HASH_CONTEXT_EVENT, open)
    return () => window.removeEventListener(REVIO_HASH_CONTEXT_EVENT, open)
  }, [])
  useEffect(() => {
    if (!target) {
      return
    }
    let current = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      void searchWorkItems(query)
        .catch(() => [])
        .then((found) => {
          if (current) {
            setItems(found)
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [target, query])
  const pick = (item: GitHubWorkItem | undefined): void => {
    if (item && target) {
      const input = target
      setTarget(null)
      requestAnimationFrame(() => {
        if (insertWorkItemContext(input, item)) {
          void attachWorkItemContext(input, item, readWorkItemDetails)
        }
      })
    }
  }
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle>
          {translate('auto.components.revioLayout.hashContext.title', 'Add PR or issue context')}
        </DialogTitle>
        <Input
          autoFocus
          value={query}
          placeholder={translate(
            'auto.components.revioLayout.hashContext.search',
            'Search pull requests and issues...'
          )}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const step = event.key === 'ArrowDown' ? 1 : -1
              setActive((index) => Math.max(0, Math.min(items.length - 1, index + step)))
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              pick(items[active])
            }
          }}
        />
        <ul
          role="listbox"
          aria-busy={loading}
          className="scrollbar-sleek flex max-h-80 flex-col overflow-y-auto"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(item)}
            >
              {item.type === 'pr' ? (
                <GitPullRequest className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <CircleDot className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="text-muted-foreground tabular-nums">#{item.number}</span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {translate(
                'auto.components.revioLayout.hashContext.none',
                'No open pull requests or issues'
              )}
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
