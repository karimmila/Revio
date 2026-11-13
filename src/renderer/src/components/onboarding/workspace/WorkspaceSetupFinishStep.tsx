import type React from 'react'
import { Check, Clock } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { WORKSPACE_SETUP_STEP_IDS } from '../../../../../shared/workspace-setup'
import type { ConnectableStepId, StepMark } from './workspace-setup-steps'
import { workspaceSetupStepLabel } from './workspace-setup-copy'

/** A project is added, not connected; the other steps are connections. */
export function markLabel(mark: StepMark, id: ConnectableStepId): string {
  if (mark !== 'done') {
    return translate('components.onboarding.workspace.finish.later', 'Set up later in Settings')
  }
  return id === 'project'
    ? translate('components.onboarding.workspace.finish.projectAdded', 'Added')
    : translate('components.onboarding.workspace.status.connected', 'Connected')
}

export function WorkspaceSetupFinishStep({
  summary,
  onOpenStep
}: {
  summary: { id: ConnectableStepId; mark: StepMark }[]
  onOpenStep: (index: number) => void
}): React.JSX.Element {
  return (
    <ul className="flex max-w-lg flex-col divide-y divide-border rounded-lg border border-border">
      {summary.map(({ id, mark }) => (
        <li key={id} className="flex items-center gap-3 px-3.5 py-3 text-[13px]">
          {mark === 'done' ? (
            <Check className="size-4 shrink-0 text-status-success" aria-hidden />
          ) : (
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="min-w-0 flex-1 font-medium">{workspaceSetupStepLabel(id)}</span>
          <span className="text-muted-foreground">{markLabel(mark, id)}</span>
          {mark === 'done' ? null : (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[12px] text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenStep(WORKSPACE_SETUP_STEP_IDS.indexOf(id))}
            >
              {translate('components.onboarding.workspace.finish.setUpNow', 'Set up now')}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
