import React from 'react'
import { Check, Circle, Copy, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { SetupStatus } from './workspace-setup-steps'
import { setupStatusLabel } from './workspace-setup-copy'

export function SetupStatusBadge({
  status,
  label
}: {
  status: SetupStatus
  /** Overrides the plain Connected / Not connected wording. */
  label?: string
}): React.JSX.Element {
  const Icon = status === 'connected' ? Check : status === 'checking' ? Loader2 : Circle
  return (
    <span
      role="status"
      data-setup-status={status}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium',
        status === 'connected'
          ? 'border-status-success-border bg-status-success-background text-status-success'
          : 'border-border text-muted-foreground'
      )}
    >
      <Icon className={cn('size-3', status === 'checking' && 'animate-spin')} aria-hidden />
      {label ?? setupStatusLabel(status)}
    </span>
  )
}

/** Settings rows inside the flow pick up the Settings page's row and button styles. */
export function SetupRows({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div data-revio-settings="" data-workspace-setup-rows="" className="bg-transparent!">
      {children}
    </div>
  )
}

/** A terminal command with a Copy button, so nobody retypes it. */
export function SetupCommand({ children }: { children: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  const label = copied
    ? translate('components.onboarding.workspace.commandCopied', 'Copied')
    : translate('components.onboarding.workspace.copyCommand', 'Copy command')
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
        {children}
      </code>
      <button
        type="button"
        aria-label={label}
        title={label}
        data-setup-command-copy=""
        onClick={() =>
          void window.api.ui
            .writeClipboardText(children)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
        className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3" aria-hidden />
        ) : (
          <Copy className="size-3" aria-hidden />
        )}
      </button>
    </span>
  )
}

export function ipcErrorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}
