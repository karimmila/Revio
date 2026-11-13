import React from 'react'
import { createPortal } from 'react-dom'
import { Minimize2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { startCloudDesktop } from '@/lib/cloud-desktop'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import { CloudDesktopView } from './CloudDesktopView'

// Started desktops by sandbox environment, so switching tabs or workspaces does not restart one.
const started = new Map<string, Promise<string>>()
const MAX_RECONNECTS = 5
const RECONNECT_DELAY_MS = 3_000

function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

export function useActiveCloudEnvironmentId(): string | null {
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  return useAppStore((s) => {
    const repo = s.repos.find((candidate) => candidate.id === s.activeWorktreeId?.split('::')[0])
    if (!repo || !isCloudRepo(repo, cloudEnvironmentIds)) {
      return null
    }
    const host = parseExecutionHostId(repo.executionHostId)
    return host?.kind === 'runtime' ? host.environmentId : null
  })
}

/** The expanded "Cloud desktop": the same screen, large and interactive. */
function ExpandedDesktop({
  url,
  onClose
}: {
  url: string
  onClose: () => void
}): React.JSX.Element {
  React.useEffect(() => {
    // Escape inside the desktop belongs to its apps; Escape elsewhere in Orca collapses it.
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      const inDesktop =
        target instanceof Element && target.closest('[data-cloud-desktop-view]') !== null
      if (event.key === 'Escape' && !inDesktop) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-black/60 p-7" data-revio-cloud-desktop-expanded="">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex h-9 shrink-0 items-center px-3 text-[13px] font-medium">
          {translate('auto.components.revioLayout.cloudDesktopTitle', 'Cloud desktop')}
          <button
            type="button"
            onClick={onClose}
            aria-label={translate('auto.components.revioLayout.collapseDesktop', 'Collapse')}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Minimize2 className="size-3.5" />
          </button>
        </div>
        <CloudDesktopView
          wsUrl={url}
          viewOnly={false}
          autoFocus
          className="relative min-h-0 w-full flex-1 bg-black"
        />
      </div>
    </div>,
    document.body
  )
}

/**
 * The right-panel Desktop: a live preview of the cloud workspace's sandbox screen at the
 * panel's width, in the screen's own 16:10 shape. Clicking it opens the screen large to work in.
 * The first open starts the desktop in the sandbox; later opens reuse it.
 */
export default function RevioCloudDesktopPanel(): React.JSX.Element {
  const environmentId = useActiveCloudEnvironmentId()
  const [view, setView] = React.useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null
  })
  const [expanded, setExpanded] = React.useState(false)
  const close = React.useCallback(() => setExpanded(false), [])
  // A wake gives the sandbox a new tunnel port, and the panel can open while the sandbox is
  // still waking, so a dropped or failed desktop starts again, a few times.
  const [attempt, setAttempt] = React.useState(0)
  const reconnect = React.useCallback(() => {
    if (!environmentId || attempt >= MAX_RECONNECTS) {
      return
    }
    started.delete(environmentId)
    window.setTimeout(() => setAttempt((value) => value + 1), RECONNECT_DELAY_MS)
  }, [environmentId, attempt])
  const reconnectRef = React.useRef(reconnect)
  reconnectRef.current = reconnect
  React.useEffect(() => {
    if (!environmentId) {
      return
    }
    let live = true
    setView({ url: null, error: null })
    let pending = started.get(environmentId)
    if (!pending) {
      pending = startCloudDesktop(environmentId)
      started.set(environmentId, pending)
      // A failed start is retried on the next open.
      pending.catch(() => started.delete(environmentId))
    }
    pending
      .then((url) => live && setView({ url, error: null }))
      .catch((error: unknown) => {
        if (live) {
          setView({ url: null, error: errorText(error) })
          reconnectRef.current()
        }
      })
    return () => {
      live = false
    }
  }, [environmentId, attempt])
  if (!environmentId) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        {translate(
          'auto.components.revioLayout.desktopCloudOnly',
          'The desktop is for cloud workspaces.'
        )}
      </p>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2" data-revio-cloud-desktop="">
      {view.url ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={translate('auto.components.revioLayout.expandDesktop', 'Open desktop')}
          className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-md border border-border bg-black"
        >
          {/* The preview is view-only and ignores the pointer, so a click opens the large view. */}
          <CloudDesktopView
            wsUrl={view.url}
            onDisconnected={reconnect}
            viewOnly
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </button>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-border bg-black/60 px-3 text-center text-xs text-muted-foreground">
          {view.error ??
            translate('auto.components.revioLayout.desktopStarting', 'Starting the desktop…')}
        </div>
      )}
      {expanded && view.url ? <ExpandedDesktop url={view.url} onClose={close} /> : null}
    </div>
  )
}
