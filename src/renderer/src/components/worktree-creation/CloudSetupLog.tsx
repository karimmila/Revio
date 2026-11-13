import React from 'react'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

/** "Show logs" disclosure for the recipe output: closed while setup runs, open once it fails. */
export function CloudSetupLog({
  log,
  defaultOpen,
  toggleLabels
}: {
  log: string
  defaultOpen: boolean
  toggleLabels?: { show: string; hide: string }
}): React.JSX.Element {
  // Follow the failure default until the viewer chooses; their choice then sticks.
  const [chosen, setChosen] = React.useState<boolean | null>(null)
  const open = chosen ?? defaultOpen
  const contentId = React.useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setChosen(!open)}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          {open
            ? (toggleLabels?.hide ??
              translate('auto.components.worktree.creation.CloudSetupLog.hideLogs', 'Hide logs'))
            : (toggleLabels?.show ??
              translate('auto.components.worktree.creation.CloudSetupLog.showLogs', 'Show logs'))}
        </button>
        {open && log ? <CopyLogButton log={log} /> : null}
      </div>
      {open ? <LogOutput id={contentId} log={log} /> : null}
    </div>
  )
}

function CopyLogButton({ log }: { log: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  const label = copied
    ? translate('auto.components.worktree.creation.CloudSetupLog.copied', 'Copied')
    : translate('auto.components.worktree.creation.CloudSetupLog.copyLogs', 'Copy logs')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onClick={() => {
        void window.api.ui.writeClipboardText(log).then(() => setCopied(true))
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

function LogOutput({ id, log }: { id: string; log: string }): React.JSX.Element {
  const ref = React.useRef<HTMLPreElement>(null)
  // Follow new output until the viewer scrolls up; resume once they return to the bottom.
  const pinnedToBottomRef = React.useRef(true)
  const handleScroll = React.useCallback((): void => {
    const el = ref.current
    if (el) {
      pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    }
  }, [])
  React.useEffect(() => {
    const el = ref.current
    if (el && pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [log])
  return (
    <pre
      id={id}
      ref={ref}
      tabIndex={0}
      onScroll={handleScroll}
      className="scrollbar-sleek max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-4 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {log || (
        <span className="text-muted-foreground/60">
          {translate(
            'auto.components.worktree.creation.CloudSetupLog.empty',
            'Waiting for output…'
          )}
        </span>
      )}
    </pre>
  )
}
