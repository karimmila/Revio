import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { chevronScrollLeft, wholeTabs, type TabExtent, type TabStripView } from './revio-tab-fit'

// Tailwind w-6 and w-8 on the chevron buttons below.
const CHEVRON = { left: 24, right: 32 }

type Strip = { tabs: HTMLElement[]; extents: TabExtent[]; view: TabStripView }

function readStrip(node: HTMLDivElement): Strip {
  const origin = node.getBoundingClientRect().left - node.scrollLeft
  const tabs = [...node.children].filter((child) => child instanceof HTMLElement)
  const extents = tabs.map((tab) => {
    const rect = tab.getBoundingClientRect()
    return { start: rect.left - origin, end: rect.right - origin }
  })
  const edges = {
    left: node.scrollLeft > 1,
    right: node.scrollLeft + node.clientWidth < node.scrollWidth - 1
  }
  const view = { scrollLeft: node.scrollLeft, width: node.clientWidth, chevron: CHEVRON, edges }
  return { tabs, extents, view }
}

/**
 * The workspace layout keeps tab labels whole: a narrow strip shows only the tabs that fit, and a
 * chevron scrolls the next one into view.
 */
export function RevioTabScroller({ children }: { children: React.ReactNode }): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null)
  const activeRef = React.useRef<Element | null>(null)
  const [edges, setEdges] = React.useState({ left: false, right: false })

  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }
    const update = (): void => {
      const { tabs, extents, view } = readStrip(node)
      const { left, right } = view.edges
      setEdges((previous) =>
        previous.left === left && previous.right === right ? previous : { left, right }
      )
      const whole = wholeTabs(extents, view)
      tabs.forEach((tab, index) => {
        // visibility keeps the tab's width, so the scroll positions do not shift under the person.
        tab.style.visibility = whole[index] ? '' : 'hidden'
      })
    }
    update()
    // A tab picked from the keyboard or a link must not stay hidden behind a chevron.
    const active = node.querySelector(':scope > [aria-current="page"]')
    if (active !== activeRef.current) {
      activeRef.current = active
      if (active instanceof HTMLElement && active.style.visibility === 'hidden') {
        active.scrollIntoView({ block: 'nearest', inline: 'center' })
      }
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    for (const child of node.children) {
      observer.observe(child)
    }
    node.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      node.removeEventListener('scroll', update)
    }
  }, [children])

  const scrollBy = (direction: 1 | -1): void => {
    const node = ref.current
    if (node) {
      const { extents, view } = readStrip(node)
      node.scrollTo({ left: chevronScrollLeft(extents, view, direction), behavior: 'smooth' })
    }
  }

  return (
    <div className="relative flex min-w-0 shrink items-center">
      <div
        ref={ref}
        className="flex min-w-0 shrink items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edges.left ? (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label={translate('auto.components.revioLayout.scrollTabsLeft', 'Show earlier tabs')}
          className="absolute inset-y-0 left-0 flex w-6 items-center justify-start bg-gradient-to-r from-sidebar from-50% to-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      ) : null}
      {edges.right ? (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label={translate('auto.components.revioLayout.scrollTabsRight', 'Show more tabs')}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-sidebar from-40% to-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
