import React from 'react'
import { Circle, CircleCheck, CircleX, Loader2, RotateCcw } from 'lucide-react'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../../shared/cloud/cloud-recipe'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  cleanCloudSetupLog,
  latestCloudSetupLogLine,
  cloudSetupStepLabel,
  currentCloudSetupStep,
  deriveCloudSetupSteps,
  type CloudSetupEntry,
  type CloudSetupStep
} from '@/lib/workspace/creation/cloud-setup-steps'
import { CloudSetupLog } from './CloudSetupLog'
import { formatElapsedTime } from './worktree-creation-clock'

function StepIcon({ state }: { state: CloudSetupStep['state'] }): React.JSX.Element {
  switch (state) {
    case 'running':
      return (
        <Loader2
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground motion-safe:animate-spin"
        />
      )
    case 'done':
      return <CircleCheck aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
    case 'failed':
      return <CircleX aria-hidden className="size-3.5 shrink-0 text-destructive" />
    case 'pending':
      return <Circle aria-hidden className="size-3.5 shrink-0 text-muted-foreground/50" />
  }
}

function StepRow({
  step,
  isVercel,
  error,
  detail
}: {
  step: CloudSetupStep
  isVercel: boolean
  error: string | null
  detail: string | null
}): React.JSX.Element {
  return (
    <li
      className="flex flex-col gap-0.5 py-1"
      aria-current={step.state === 'running' ? 'step' : undefined}
    >
      <div className="flex items-center gap-2">
        <StepIcon state={step.state} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px]',
            step.state === 'running' && 'text-foreground',
            (step.state === 'done' || step.state === 'pending') && 'text-muted-foreground',
            step.state === 'pending' && 'opacity-70',
            step.state === 'failed' && 'text-destructive'
          )}
        >
          {cloudSetupStepLabel(step.id, step.state, isVercel)}
        </span>
        {step.elapsedMs !== null ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatElapsedTime(step.elapsedMs)}
          </span>
        ) : null}
      </div>
      {step.state === 'running' && detail ? (
        <p
          data-cloud-setup-step-detail=""
          className="ml-5.5 truncate text-xs text-muted-foreground"
        >
          {detail}
        </p>
      ) : null}
      {step.state === 'failed' && error ? (
        <p className="ml-5.5 line-clamp-2 break-words text-xs text-muted-foreground">{error}</p>
      ) : null}
    </li>
  )
}

/** Cloud workspace setup, shown in place of the workspace until it opens. */
export function CloudSetupCard({
  entry,
  now,
  error,
  onCancel,
  onRetry,
  onDismiss
}: {
  entry: CloudSetupEntry
  now: number
  error: string | null
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const isError = entry.status === 'error'
  const isVercel = entry.request.ephemeralVmRecipe?.recipeId === VERCEL_CLOUD_RECIPE_ID
  const steps = deriveCloudSetupSteps(entry, now)
  const doneCount = steps.filter((step) => step.state === 'done').length
  const current = currentCloudSetupStep(steps)
  const titleId = React.useId()
  const latestLine = latestCloudSetupLogLine(entry.provisioningLog ?? '')
  const name = entry.request.displayName || entry.request.name
  const branch = entry.request.branchNameOverride
  return (
    <div className="scrollbar-sleek flex h-full justify-center overflow-y-auto px-4 pb-8 pt-[12vh]">
      <section
        aria-labelledby={titleId}
        className="flex h-fit w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
      >
        <header className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className={cn('text-sm font-medium', isError && 'text-destructive')}>
              {isError
                ? translate(
                    'auto.components.worktree.creation.CloudSetupCard.titleFailed',
                    'Couldn’t set up your cloud workspace'
                  )
                : translate(
                    'auto.components.worktree.creation.CloudSetupCard.title',
                    'Setting up your cloud workspace'
                  )}
            </h2>
            {isError ? null : (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatElapsedTime(now - entry.startedAt)}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {branch && branch !== name ? `${name} · ${branch}` : name}
          </p>
        </header>
        <Progress
          value={(doneCount / steps.length) * 100}
          aria-label={translate(
            'auto.components.worktree.creation.CloudSetupCard.progress',
            'Setup progress'
          )}
          className="h-0.5"
        />
        <p className="sr-only" aria-live="polite">
          {current ? cloudSetupStepLabel(current.id, current.state, isVercel) : ''}
        </p>
        <ol className="flex flex-col">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              isVercel={isVercel}
              error={error}
              detail={latestLine}
            />
          ))}
        </ol>
        <CloudSetupLog
          log={cleanCloudSetupLog(entry.provisioningLog ?? '')}
          defaultOpen={isError}
        />
        <footer className="flex items-center justify-end gap-1.5 border-t border-border pt-3">
          {isError ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                {translate(
                  'auto.components.worktree.creation.WorktreeCreationPanel.dabd226118',
                  'Dismiss'
                )}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw />
                {translate(
                  'auto.components.worktree.creation.WorktreeCreationPanel.34dd5ee38b',
                  'Retry'
                )}
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {translate(
                'auto.components.worktree.creation.WorktreeCreationPanel.cancelProvisioning',
                'Cancel'
              )}
            </Button>
          )}
        </footer>
      </section>
    </div>
  )
}
