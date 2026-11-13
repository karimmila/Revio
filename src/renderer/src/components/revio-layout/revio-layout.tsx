import React from 'react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

/** Workspace layout: text tabs, a two-row sidebar nav and per-row line totals. */
export function useRevioLayout(): boolean {
  return useAppStore((s) => s.settings?.revioLayout === true)
}

export function formatCompactCount(value: number): string {
  if (value < 1000) {
    return String(value)
  }
  const thousands = value / 1000
  return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`
}

/**
 * Files this workspace changes against its base: branch commits plus the working tree, counted
 * once per path. Either list may still be loading; the count grows as they arrive.
 */
export function useWorkspaceChangeCount(
  worktreeId: string | null,
  includeCommitted = true
): number {
  const branchEntries = useAppStore((s) =>
    worktreeId && includeCommitted ? s.gitBranchChangesByWorktree?.[worktreeId] : undefined
  )
  const statusEntries = useAppStore((s) =>
    worktreeId ? s.gitStatusByWorktree?.[worktreeId] : undefined
  )
  return React.useMemo(() => {
    const paths = new Set<string>()
    for (const entry of branchEntries ?? []) {
      paths.add(entry.path)
    }
    for (const entry of statusEntries ?? []) {
      paths.add(entry.path)
    }
    return paths.size
  }, [branchEntries, statusEntries])
}

/**
 * `+added −removed` against the merge base, shown on each workspace row. Orca only
 * computes the total for workspaces whose Git status it has loaded, so other rows stay blank.
 */
export function RevioLineTotal({
  worktreeId,
  className,
  sidebarRow = false
}: {
  worktreeId: string
  className?: string
  /** Sidebar rows color the totals only for the selected workspace unless "Colored sidebar diffs". */
  sidebarRow?: boolean
}): React.JSX.Element | null {
  const enabled = useRevioLayout()
  const total = useAppStore((s) => s.gitBranchLineTotalByWorktree?.[worktreeId] ?? null)
  const muted = useAppStore(
    (s) =>
      sidebarRow &&
      s.settings?.revioColoredSidebarDiffs !== true &&
      s.activeWorktreeId !== worktreeId
  )
  if (!enabled || !total || (total.added === 0 && total.removed === 0)) {
    return null
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums',
        className
      )}
      aria-label={translate('auto.components.revioLayout.lineTotals', '{{added}}, {{deleted}}', {
        added: translate('auto.components.revioLayout.linesAdded', '{{count}} lines added', {
          count: total.added,
          defaultValue_one: '{{count}} line added'
        }),
        deleted: translate('auto.components.revioLayout.linesDeleted', '{{count}} lines deleted', {
          count: total.removed,
          defaultValue_one: '{{count}} line deleted'
        })
      })}
    >
      {total.added > 0 ? (
        <span
          className={muted ? 'text-muted-foreground' : 'text-[color:var(--git-decoration-added)]'}
        >
          +{formatCompactCount(total.added)}
        </span>
      ) : null}
      {total.removed > 0 ? (
        <span
          className={muted ? 'text-muted-foreground' : 'text-[color:var(--git-decoration-deleted)]'}
        >
          -{formatCompactCount(total.removed)}
        </span>
      ) : null}
    </span>
  )
}

const RIGHT_COLUMN_SHARE_KEY = 'orca.revioRightColumnShare'
// Measured: the right column takes 608 of the 1308pt beside a 420pt sidebar.
const DEFAULT_RIGHT_COLUMN_SHARE = 0.465

function readRightColumnShare(): number {
  try {
    const stored = Number(window.localStorage.getItem(RIGHT_COLUMN_SHARE_KEY))
    return stored > 0.15 && stored < 0.85 ? stored : DEFAULT_RIGHT_COLUMN_SHARE
  } catch {
    return DEFAULT_RIGHT_COLUMN_SHARE
  }
}

/**
 * The workspace layout sizes the right column as a share of the space beside the left sidebar, so
 * both columns shrink together. Returns null outside the workspace layout to keep Orca's fixed
 * width.
 */
export function useRevioRightColumnWidth(windowWidth: number | null): {
  width: number
  setWidth: (width: number) => void
} | null {
  const enabled = useRevioLayout()
  const leftWidth = useAppStore((s) => (s.sidebarOpen ? s.sidebarWidth : 0))
  const [share, setShare] = React.useState(readRightColumnShare)
  const available = Math.max(1, (windowWidth ?? window.innerWidth) - leftWidth)
  const setWidth = React.useCallback(
    (width: number) => {
      const next = Math.min(0.85, Math.max(0.15, width / available))
      setShare(next)
      try {
        window.localStorage.setItem(RIGHT_COLUMN_SHARE_KEY, String(next))
      } catch {
        // Private windows can refuse storage; the share still applies for this session.
      }
    },
    [available]
  )
  return enabled ? { width: Math.round(available * share), setWidth } : null
}

/**
 * Marks the document so workspace-layout-only CSS (see main.css) applies while the layout is on.
 */
export function useRevioRootAttribute(): void {
  const enabled = useRevioLayout()
  const sendWithModEnter = useAppStore((s) => s.settings?.revioSendWithModEnter === true)
  const pasteAsAttachment = useAppStore((s) => s.settings?.revioPasteLongTextAsAttachment !== false)
  const lowContrast = useAppStore((s) => s.settings?.revioLowContrastDark === true)
  const colorVision = useAppStore((s) => s.settings?.revioAccessibleColors === true)
  const tufte = useAppStore((s) => s.settings?.revioMarkdownStyle === 'tufte')
  React.useEffect(() => {
    const root = document.documentElement
    if (enabled) {
      root.dataset.revioLayout = 'true'
    } else {
      delete root.dataset.revioLayout
    }
    // Composer key and paste handlers read these at event time, so they need no store import.
    setRootFlag(root, 'revioSendModEnter', enabled && sendWithModEnter)
    setRootFlag(root, 'revioPasteInline', enabled && !pasteAsAttachment)
    setRootFlag(root, 'revioLowContrast', enabled && lowContrast)
    setRootFlag(root, 'revioColorVision', enabled && colorVision)
    setRootFlag(root, 'revioMarkdownTufte', enabled && tufte)
  }, [enabled, sendWithModEnter, pasteAsAttachment, lowContrast, colorVision, tufte])
}

function setRootFlag(root: HTMLElement, name: string, on: boolean): void {
  if (on) {
    root.dataset[name] = 'true'
  } else {
    delete root.dataset[name]
  }
}
