import React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { COMBINED_DIFF_VIEWPORT_SELECTOR } from '@/components/editor/combined-diff/scroll-viewport/combined-diff-viewport'
import { commentsOutOfView, navigateCombined } from './revio-comment-nav'
import { revioLayoutActive } from './revio-root-flags'

// Key symbols, not words: they read the same in every locale.
const PREVIOUS_KEY = '⌘⌥K'
const NEXT_KEY = '⌘⌥J'

/**
 * The floating "Previous comment N" / "Next comment N" buttons over the all-changes diff.
 * Place it beside the viewport inside the same relative box. Hidden outside the workspace layout.
 */
export function RevioCommentPills(): React.JSX.Element | null {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null)
  const [counts, setCounts] = React.useState({ previous: 0, next: 0 })
  const enabled = revioLayoutActive()
  React.useEffect(() => {
    const viewport = anchorRef.current?.parentElement?.querySelector<HTMLElement>(
      COMBINED_DIFF_VIEWPORT_SELECTOR
    )
    if (!enabled || !viewport) {
      return
    }
    let frame = 0
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = commentsOutOfView(viewport)
        setCounts((current) =>
          current.previous === next.previous && current.next === next.next ? current : next
        )
      })
    }
    update()
    viewport.addEventListener('scroll', update, { passive: true })
    const observer = new MutationObserver(update)
    observer.observe(viewport, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [enabled])
  const go = (direction: 'previous' | 'next'): void => {
    const viewport = anchorRef.current?.parentElement?.querySelector<HTMLElement>(
      COMBINED_DIFF_VIEWPORT_SELECTOR
    )
    if (viewport) {
      navigateCombined(viewport, direction)
    }
  }
  if (!enabled) {
    return null
  }
  return (
    <>
      <span ref={anchorRef} hidden />
      {counts.previous > 0 ? (
        <div className="revio-comment-pill" data-edge="top">
          <Button type="button" variant="outline" size="xs" onClick={() => go('previous')}>
            <ArrowUp className="size-3" />
            {translate('auto.components.revioLayout.diff.previousComment', 'Previous comment')}
            <span className="tabular-nums text-muted-foreground">{counts.previous}</span>
            <kbd className="text-muted-foreground">{PREVIOUS_KEY}</kbd>
          </Button>
        </div>
      ) : null}
      {counts.next > 0 ? (
        <div className="revio-comment-pill" data-edge="bottom">
          <Button type="button" variant="outline" size="xs" onClick={() => go('next')}>
            <ArrowDown className="size-3" />
            {translate('auto.components.revioLayout.diff.nextComment', 'Next comment')}
            <span className="tabular-nums text-muted-foreground">{counts.next}</span>
            <kbd className="text-muted-foreground">{NEXT_KEY}</kbd>
          </Button>
        </div>
      ) : null}
    </>
  )
}
