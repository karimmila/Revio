import React from 'react'
import { ChevronUp, Plus, SquareTerminal } from 'lucide-react'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { translate } from '@/i18n/i18n'
import {
  createDockTerminalForActiveWorkspace,
  findDockTerminalForWorkspace,
  isDockTabForWorkspace,
  openRevioDockTerminal
} from './revio-dock-terminals'
import { dockHasNothingForWorkspace } from './revio-dock-visibility'
import { RevioRunButton } from './RevioRunButton'
import { selectWorktreeCreationSurfaceShown } from '@/lib/workspace/creation/worktree-creation-surface'

export type DockRect = { left: number; top: number; width: number; height: number }

// The right column measures the dock; the floating workspace panel reads it and sits there.
let dockRect: DockRect | null = null
const listeners = new Set<() => void>()

function setDockRect(next: DockRect | null): void {
  const same =
    dockRect === next ||
    (dockRect !== null &&
      next !== null &&
      dockRect.left === next.left &&
      dockRect.top === next.top &&
      dockRect.width === next.width &&
      dockRect.height === next.height)
  if (same) {
    return
  }
  dockRect = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Where the terminal dock is on screen, or null when no dock is showing. */
export function useRevioTerminalDockRect(): DockRect | null {
  return React.useSyncExternalStore(subscribe, () => dockRect)
}

const DOCK_SHARE_KEY = 'orca.revioDockShare'
// Measured: the panel starts 74% down a 1006pt window.
const DEFAULT_DOCK_SHARE = 0.26

function readDockShare(): number {
  try {
    const stored = Number(window.localStorage.getItem(DOCK_SHARE_KEY))
    return stored >= 0.12 && stored <= 0.85 ? stored : DEFAULT_DOCK_SHARE
  } catch {
    return DEFAULT_DOCK_SHARE
  }
}

/** The dock's share of the right column, dragged from its top edge. */
function useDockShare(): {
  share: number
  startResize: (event: React.PointerEvent<HTMLDivElement>) => void
} {
  const [share, setShare] = React.useState(readDockShare)
  const startResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const column = event.currentTarget.parentElement?.parentElement
    if (!column) {
      return
    }
    event.preventDefault()
    const bounds = column.getBoundingClientRect()
    let latest = readDockShare()
    const move = (moveEvent: PointerEvent): void => {
      latest = Math.min(0.85, Math.max(0.12, (bounds.bottom - moveEvent.clientY) / bounds.height))
      setShare(latest)
    }
    const end = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      try {
        window.localStorage.setItem(DOCK_SHARE_KEY, String(latest))
      } catch {
        // Storage can be refused; the height still holds for this session.
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }, [])
  return { share, startResize }
}

/**
 * The bottom panel in the right column. Orca's floating workspace terminal docks into this
 * area while it is open, showing only the active workspace's terminals; closed, the panel folds to
 * its header, as the chevron does.
 */
export function RevioTerminalDock(): React.JSX.Element {
  const open = useAppStore((s) => s.floatingWorkspacePanelOpen)
  const ref = React.useRef<HTMLDivElement>(null)
  const { share, startResize } = useDockShare()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  // Creation keeps the prior workspace active until handoff, so the dock would show that
  // workspace's shell and Run button under the one being set up.
  const settingUp = useAppStore(selectWorktreeCreationSurfaceShown)
  // The dock's own terminals run on this Mac; a remote workspace's terminals are tabs on its host,
  // and only its Setup and Run (reached over ssh) live here. With neither, the dock has nothing
  // to show there and stays folded, but the saved "open" is left alone: closing it here made the
  // dock come back folded after a restart, when the workspace's tabs are restored a moment later.
  const nothingToShow = useAppStore((s) =>
    dockHasNothingForWorkspace(
      activeWorktreeId,
      (s.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map((tab) => tab.id)
    )
  )
  const shown = open && !nothingToShow
  const showsTerminal = shown && !settingUp
  const dockActiveTabId = useAppStore(
    (s) => s.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]?.[0]?.activeTabId ?? null
  )

  // The panel belongs to the workspace: show its terminal, or open one in its folder.
  React.useEffect(() => {
    if (!showsTerminal || !activeWorktreeId) {
      return
    }
    const state = useAppStore.getState()
    const shown = state.unifiedTabsByWorktree?.[FLOATING_TERMINAL_WORKTREE_ID]?.find(
      (tab) => tab.id === dockActiveTabId
    )
    if (shown && isDockTabForWorkspace(shown.entityId, activeWorktreeId)) {
      return
    }
    const liveTabIds = (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map(
      (tab) => tab.id
    )
    const existing = findDockTerminalForWorkspace(liveTabIds, activeWorktreeId)
    if (existing) {
      // The panel shows its tab group's active tab, so the group needs the switch as well.
      const unified = state.unifiedTabsByWorktree?.[FLOATING_TERMINAL_WORKTREE_ID]?.find(
        (tab) => tab.entityId === existing
      )
      if (unified) {
        state.activateTab(unified.id, {
          worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
          recordFocus: false
        })
      }
      state.setActiveTabForWorktree(FLOATING_TERMINAL_WORKTREE_ID, existing)
    } else {
      createDockTerminalForActiveWorkspace()
    }
  }, [activeWorktreeId, dockActiveTabId, showsTerminal])

  React.useLayoutEffect(() => {
    const node = ref.current
    if (!showsTerminal || !node) {
      setDockRect(null)
      return
    }
    const report = (): void => {
      const rect = node.getBoundingClientRect()
      setDockRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(node)
    // Sidebar drags move the dock without resizing it, so position changes need their own signal.
    window.addEventListener('resize', report)
    const interval = window.setInterval(report, 500)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
      window.clearInterval(interval)
      setDockRect(null)
    }
  }, [showsTerminal])

  if (settingUp) {
    const notice = translate(
      'auto.components.revioLayout.terminalAfterSetup',
      'Terminal is available when setup finishes'
    )
    return shown ? (
      <div
        data-revio-dock-setting-up=""
        className="flex min-h-44 shrink-0 flex-col border-t border-border"
        style={{ height: `${share * 100}%` }}
      >
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
          {notice}
        </div>
      </div>
    ) : (
      <div
        data-revio-dock-setting-up=""
        className="flex h-9 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[11px] text-muted-foreground"
      >
        <SquareTerminal className="size-3.5" />
        {notice}
      </div>
    )
  }
  if (!shown) {
    return (
      <div className="flex h-9 shrink-0 items-center gap-1 border-t border-border px-1.5">
        <button
          type="button"
          onClick={() => void openRevioDockTerminal()}
          aria-label={translate('auto.components.revioLayout.showTerminal', 'Show terminal')}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void openRevioDockTerminal()}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <SquareTerminal className="size-3.5" />
          {translate('auto.components.revioLayout.terminal', 'Terminal')}
        </button>
        <button
          type="button"
          onClick={() => void openRevioDockTerminal()}
          aria-label={translate('auto.components.revioLayout.newTerminal', 'New terminal')}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
        <RevioRunButton />
      </div>
    )
  }
  return (
    <div className="flex min-h-44 shrink-0 flex-col" style={{ height: `${share * 100}%` }}>
      {/* Above the docked panel's rect, so the panel never covers it. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={translate('auto.components.revioLayout.resizeTerminal', 'Resize terminal')}
        onPointerDown={startResize}
        className="h-1 shrink-0 cursor-row-resize border-t border-border transition-colors hover:bg-accent"
      />
      <div className="flex h-8 shrink-0 items-center px-1.5">
        <RevioRunButton />
      </div>
      <div ref={ref} className="min-h-0 flex-1" />
    </div>
  )
}
