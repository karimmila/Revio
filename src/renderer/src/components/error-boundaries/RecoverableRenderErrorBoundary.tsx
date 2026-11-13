import React from 'react'
import { AlertTriangle, RotateCw, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isLazyChunkLoadError } from '@/lib/lazy-with-retry'
import { reportReactErrorBoundaryCrash } from '@/lib/react-error-boundary-reporting'
import type { ReactErrorBoundaryReportArgs } from '../../../../shared/crash-reporting'
import { translate } from '@/i18n/i18n'
import { AppErrorSupportActions } from './AppErrorSupportActions'

type BoundaryFallbackArgs = {
  error: Error | null
  reset: () => void
}

type Props = {
  boundaryId: string
  surface: ReactErrorBoundaryReportArgs['surface']
  children: React.ReactNode
  className?: string
  compact?: boolean
  reportAsCrash?: boolean
  /** The whole window failed: lead with Reload and offer the issue tracker and the logs folder. */
  appLevel?: boolean
  resetKey?: string | number | boolean | null
  title?: string
  description?: string
  fallback?: (args: BoundaryFallbackArgs) => React.ReactNode
}

type State = {
  error: Error | null
  resetKey: Props['resetKey']
}

export class RecoverableRenderErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey }
    }
    return null
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[${this.props.boundaryId}] render crash contained by boundary`, error, errorInfo)
    if (this.props.reportAsCrash === false) {
      return
    }
    if (isLazyChunkLoadError(error)) {
      // Contained by this fallback; recovery breadcrumbs live on the load path.
      return
    }
    void reportReactErrorBoundaryCrash({
      boundaryId: this.props.boundaryId,
      surface: this.props.surface,
      error,
      errorInfo
    })
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  // The error screen offers its logs and a restart; these are Orca's equivalents.
  handleCopyDetails = (): void => {
    const { error } = this.state
    if (error) {
      void window.api?.ui?.writeClipboardText(
        `${error.name}: ${error.message}\n${error.stack ?? ''}`
      )
    }
  }

  handleRestart = (): void => {
    void window.api?.app?.restart().catch(() => {})
  }

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: this.handleReset })
    }

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground',
          this.props.compact ? 'min-h-9 py-2' : 'h-full min-h-0 py-8',
          this.props.className
        )}
        role="alert"
      >
        <div className="flex size-8 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <div className="space-y-1">
          <div className="font-medium text-foreground">
            {this.props.title ??
              translate(
                'auto.components.error.boundaries.RecoverableRenderErrorBoundary.ab855c11f4',
                'This part of {{productName}} hit an error.'
              )}
          </div>
          <div className="max-w-md text-xs">
            {this.props.description ??
              translate(
                'auto.components.error.boundaries.RecoverableRenderErrorBoundary.34a189ae0f',
                'The rest of the app is still running. Retry this surface or switch away and come back.'
              )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {this.props.appLevel ? <AppErrorSupportActions /> : null}
          <Button type="button" variant="outline" size="sm" onClick={this.handleReset}>
            <RotateCw className="size-3.5" />
            {translate(
              'auto.components.error.boundaries.RecoverableRenderErrorBoundary.55001880db',
              'Retry'
            )}
          </Button>
          {this.props.compact ? null : (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={this.handleCopyDetails}>
                <Copy className="size-3.5" />
                {translate(
                  'auto.components.error.boundaries.RecoverableRenderErrorBoundary.copyDetails',
                  'Copy error details'
                )}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={this.handleRestart}>
                {translate(
                  'auto.components.error.boundaries.RecoverableRenderErrorBoundary.restart',
                  'Restart {{productName}}'
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }
}
