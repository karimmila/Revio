import { useEffect, useRef, useState } from 'react'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { translate } from '@/i18n/i18n'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import { IMPORT_SOURCE_APP } from '../../../../../shared/import-source-app'
import type { WorkspaceImportSummary } from '../../../../../shared/workspace-import-types'
import { WorkspaceImportCard } from '../../workspace-import/WorkspaceImportCard'
import { pendingCounts } from '../../workspace-import/use-workspace-import'

type GateState =
  | { phase: 'checking' }
  | { phase: 'offer'; summary: WorkspaceImportSummary }
  | { phase: 'passed' }

/**
 * First-run step shown before setup only when another app's work is found and not yet imported.
 * Skipping or finishing it continues to the usual setup.
 */
export function WorkspaceSetupImportGate({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element | null {
  const [state, setState] = useState<GateState>(() =>
    window.api?.workspaceImport ? { phase: 'checking' } : { phase: 'passed' }
  )
  // Setup closes by unmounting this gate; the imported work then opens where it left off.
  const openWhenSetupEnds = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (openWhenSetupEnds.current) {
        activateAndRevealWorktree(openWhenSetupEnds.current)
      }
    },
    []
  )
  useEffect(() => {
    let live = true
    const api = window.api?.workspaceImport
    if (!api) {
      return
    }
    void api
      .detect()
      .then((detection) => {
        if (!live) {
          return
        }
        const pending = detection.found ? pendingCounts(detection.summary) : null
        setState(
          detection.found && pending && pending.workspaces + pending.chats > 0
            ? { phase: 'offer', summary: detection.summary }
            : { phase: 'passed' }
        )
      })
      .catch(() => live && setState({ phase: 'passed' }))
    return () => {
      live = false
    }
  }, [])
  if (state.phase === 'checking') {
    return null
  }
  if (state.phase === 'passed') {
    return <>{children}</>
  }
  const pass = (): void => setState({ phase: 'passed' })
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 text-foreground sm:p-4"
      data-onboarding-overlay
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={translate(
          'components.workspaceImport.offerTitle',
          'Bring your work from {{app}}',
          {
            app: IMPORT_SOURCE_APP
          }
        )}
        className="relative flex w-full max-w-[640px] flex-col gap-5 rounded-xl border border-border bg-card px-5 py-6 text-card-foreground shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:px-8 sm:py-7"
      >
        <span className="text-sm font-semibold tracking-tight">{FORK_PRODUCT_NAME}</span>
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-[30px]">
            {translate('components.workspaceImport.offerTitle', 'Bring your work from {{app}}', {
              app: IMPORT_SOURCE_APP
            })}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {translate(
              'components.workspaceImport.offerSubtitle',
              'Continue your workspaces and chats in {{product}}. {{app}} is not changed.',
              { product: FORK_PRODUCT_NAME, app: IMPORT_SOURCE_APP }
            )}
          </p>
        </div>
        <WorkspaceImportCard
          initial={state.summary}
          showTitle={false}
          onClose={pass}
          finishLabel={translate('components.workspaceImport.continue', 'Continue')}
          onFinished={(worktreeId) => {
            openWhenSetupEnds.current = worktreeId
            pass()
          }}
        />
      </section>
    </div>
  )
}
