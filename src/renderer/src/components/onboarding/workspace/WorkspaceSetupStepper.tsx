import type React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { WorkspaceSetupStepId } from '../../../../../shared/workspace-setup'
import type { StepMark } from './workspace-setup-steps'

export function WorkspaceSetupStepper({
  steps,
  currentIndex,
  onSelect
}: {
  steps: { id: WorkspaceSetupStepId; index: number; label: string; mark: StepMark }[]
  currentIndex: number
  onSelect: (index: number) => void
}): React.JSX.Element {
  const position = steps.findIndex((step) => step.index === currentIndex)
  return (
    <nav
      aria-label={translate('components.onboarding.workspace.steps', 'Setup steps')}
      className="mt-5 flex items-center gap-1 sm:mt-7"
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {steps.map((step, order) => {
          const active = step.index === currentIndex
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(step.index)}
                className={cn(
                  'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {step.mark === 'done' ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <span aria-hidden className="tabular-nums">
                    {order + 1}
                  </span>
                )}
                {/* Narrow windows truncate the names rather than hiding them. */}
                <span className="min-w-0 truncate">{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
        {translate(
          'auto.components.onboarding.OnboardingFlow.stepOfTotal',
          '{{current}} of {{total}}',
          {
            current: position + 1,
            total: steps.length
          }
        )}
      </span>
    </nav>
  )
}
