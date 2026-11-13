import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { onNativeChatMessageSent } from '@/components/native-chat/native-chat-message-sent-event'
import type { Worktree } from '../../../../shared/worktree/types'

/** The unread workspace touched most recently, other than the one on screen. */
function nextUnread(
  worktreesByRepo: Record<string, readonly Worktree[]>,
  activeId: string | null
): Worktree | null {
  let best: Worktree | null = null
  for (const worktrees of Object.values(worktreesByRepo)) {
    for (const worktree of worktrees) {
      if (
        worktree.isUnread &&
        worktree.id !== activeId &&
        !worktree.isArchived &&
        (best === null || worktree.lastActivityAt > best.lastActivityAt)
      ) {
        best = worktree
      }
    }
  }
  return best
}

export function goToNextUnreadWorkspace(): boolean {
  const state = useAppStore.getState()
  const target = nextUnread(selectWorktreesByRepo(state), state.activeWorktreeId)
  if (!target) {
    return false
  }
  activateAndRevealWorktree(target.id, { sidebarRevealBehavior: 'auto' })
  return true
}

/**
 * "Next chat needing attention" (⌥⌘L) from every view of the layout, Home and
 * Settings included. The code, since ⌥ turns L into ¬ on macOS.
 */
export function RevioNextUnreadKey(): null {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.metaKey &&
        event.altKey &&
        !event.shiftKey &&
        event.code === 'KeyL' &&
        goToNextUnreadWorkspace()
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
  return null
}

/** Bottom edge for the pill: just above the visible chat composer, or near the pane's foot. */
function composerOffset(container: HTMLElement | null): number {
  // Every open chat keeps a composer mounted; only the visible one has an offset parent.
  const composer = [
    ...(container?.querySelectorAll<HTMLElement>('[data-composer-field]') ?? [])
  ].find((field) => field.offsetParent !== null)
  if (!container || !composer) {
    return 24
  }
  const gap = container.getBoundingClientRect().bottom - composer.getBoundingClientRect().top
  return Math.max(24, gap + 10)
}

/**
 * The hand-off after you send a message: while the agent works on it, a button offers the
 * next workspace whose agent finished, so you can prompt one workspace after another (⌘⌥L).
 */
export function RevioNextUnread(): React.JSX.Element | null {
  const activeId = useAppStore((s) => s.activeWorktreeId)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const [offeredIn, setOfferedIn] = React.useState<string | null>(null)
  const [bottom, setBottom] = React.useState(24)
  const rootRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(
    () =>
      onNativeChatMessageSent(() => {
        const state = useAppStore.getState()
        setOfferedIn(state.activeWorktreeId)
        setBottom(composerOffset(rootRef.current?.parentElement ?? null))
      }),
    []
  )
  const target = offeredIn === activeId ? nextUnread(worktreesByRepo, activeId) : null
  return (
    <div ref={rootRef} data-revio-next-unread-anchor="" style={{ bottom }}>
      {target ? (
        <button
          type="button"
          data-revio-next-unread=""
          onClick={() => {
            setOfferedIn(null)
            activateAndRevealWorktree(target.id, { sidebarRevealBehavior: 'auto' })
          }}
        >
          <span className="truncate">
            {translate('auto.components.revioLayout.nextUnread', 'Next: {{value0}}', {
              value0: target.displayName || target.branch.replace(/^refs\/heads\//, '')
            })}
          </span>
          <kbd>{translate('auto.components.revioLayout.nextUnreadShortcut', '⌥⌘L')}</kbd>
          <ArrowRight className="size-3.5 shrink-0" />
        </button>
      ) : null}
    </div>
  )
}
