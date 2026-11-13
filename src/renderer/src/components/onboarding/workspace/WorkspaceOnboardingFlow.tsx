import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, CornerDownLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { addAppKeyListener, removeAppKeyListener } from '@/lib/app-keyboard-router'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import { WORKSPACE_SETUP_STEP_IDS } from '../../../../../shared/workspace-setup'
import type { OnboardingState } from '../../../../../shared/onboarding-state-types'
import { useWorkspaceSetupFlow } from './use-workspace-setup-flow'
import { isReopenedSetup, setupSummary, stepMark } from './workspace-setup-steps'
import { useWorkspaceSetupFocus } from './use-workspace-setup-focus'
import { describeKeyTarget, workspaceSetupKeyIntent } from './workspace-setup-keys'
import {
  workspaceSetupStepCopy,
  workspaceSetupStepLabel,
  workspaceSetupWelcome
} from './workspace-setup-copy'
import { WorkspaceSetupAgentStep } from './WorkspaceSetupAgentStep'
import { WorkspaceSetupCloudStep } from './WorkspaceSetupCloudStep'
import { WorkspaceSetupProjectStep } from './WorkspaceSetupProjectStep'
import { WorkspaceSetupGithubStep } from './WorkspaceSetupGithubStep'
import { WorkspaceSetupFinishStep } from './WorkspaceSetupFinishStep'
import { WorkspaceSetupStepper } from './WorkspaceSetupStepper'
import { RequiredToolsNotice } from '@/components/required-tools/RequiredToolsNotice'
import { useRequiredToolsCheck } from '@/components/required-tools/required-tools-check'

const quietButton =
  'inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

/** First run for the Workspace Layout: Claude, cloud, a project and GitHub, each skippable. */
export function WorkspaceOnboardingFlow({
  onboarding,
  onOnboardingChange
}: {
  onboarding: OnboardingState
  onOnboardingChange: (state: OnboardingState) => void
}): React.JSX.Element {
  const flow = useWorkspaceSetupFlow(onboarding, onOnboardingChange)
  const { live, currentId, index, location } = flow
  const tools = useRequiredToolsCheck()
  const hasProject = useAppStore((s) => s.repos.length > 0)
  // The project pickers open the app's own dialog, which sits under this overlay; step aside.
  const pickerOpen = useAppStore((s) => s.activeModal === 'add-repo')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  // Read once: the first Continue or Set up later moves the saved progress off the reopened mark.
  const [reopened] = useState(() => isReopenedSetup(onboarding.workspaceSetup))
  const shown = WORKSPACE_SETUP_STEP_IDS
  const copy = workspaceSetupStepCopy(currentId)
  const isFinish = currentId === 'finish'
  const firstShown = WORKSPACE_SETUP_STEP_IDS.indexOf(shown[0])

  const flowRef = useRef(flow)
  useEffect(() => {
    flowRef.current = flow
  })
  useEffect(() => {
    if (pickerOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const intent = workspaceSetupKeyIntent(event, describeKeyTarget(event.target), { reopened })
      if (!intent) {
        return
      }
      event.preventDefault()
      if (intent === 'continue') {
        flowRef.current.next()
      } else if (intent === 'close') {
        flowRef.current.dismiss()
      } else {
        flowRef.current.later()
      }
    }
    addAppKeyListener('keydown', onKeyDown)
    return () => removeAppKeyListener('keydown', onKeyDown)
  }, [pickerOpen, reopened])

  useWorkspaceSetupFocus({ dialogRef, headingRef, stepKey: currentId, suspended: pickerOpen })

  const primaryLabel = isFinish
    ? hasProject
      ? translate('components.onboarding.workspace.finish.create', 'Create your first workspace')
      : translate('components.onboarding.workspace.finish.done', 'Finish')
    : flow.isConnected
      ? translate('components.onboarding.flow.actions.continue', 'Continue')
      : translate('auto.components.onboarding.OnboardingFooter.111d3f8d92', 'Set up later')

  return (
    <div
      aria-hidden={pickerOpen || undefined}
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 text-foreground sm:p-4',
        pickerOpen && 'hidden'
      )}
      data-onboarding-overlay
      data-workspace-setup=""
    >
      <div
        className="absolute inset-x-0 top-0 h-8"
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: WebkitAppRegion is a valid Electron CSS property React's typings omit
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={workspaceSetupWelcome(FORK_PRODUCT_NAME)}
        data-onboarding-modal
        className="relative flex outline-none h-full max-h-[760px] w-full max-w-[880px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
      >
        <div className="flex h-full min-h-0 flex-col px-5 pt-5 pb-5 sm:px-8 sm:pt-7 sm:pb-7">
          <header className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold tracking-tight">
              {FORK_PRODUCT_NAME}
            </span>
            <button
              type="button"
              className={cn(quietButton, 'px-2')}
              aria-label={translate('components.onboarding.workspace.close', 'Close setup')}
              title={translate('components.onboarding.workspace.close', 'Close setup')}
              onClick={flow.dismiss}
            >
              <X className="size-4" />
            </button>
          </header>

          <WorkspaceSetupStepper
            steps={shown.map((id) => ({
              id,
              index: WORKSPACE_SETUP_STEP_IDS.indexOf(id),
              label: workspaceSetupStepLabel(id),
              mark: stepMark(id, live.statuses, flow.progress)
            }))}
            currentIndex={index}
            onSelect={flow.jumpTo}
          />

          {/* The title scrolls with the step: at the window's smallest size (600 by 400) a fixed
              title left the step a 39 px strip, and the GitHub step's code was clipped. */}
          <div className="scrollbar-sleek mt-6 min-h-0 flex-1 overflow-y-auto pr-1 sm:mt-8">
            <div>
              {index === firstShown ? (
                <div className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {workspaceSetupWelcome(FORK_PRODUCT_NAME)}
                </div>
              ) : null}
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl leading-tight font-semibold tracking-tight outline-none sm:text-[30px]"
              >
                {copy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {copy.subtitle}
              </p>
            </div>

            <div className="mt-6">
              <RequiredToolsNotice check={tools} className="mb-4" />
              {currentId === 'agent' ? (
                <WorkspaceSetupAgentStep
                  live={live}
                  claudeInstalled={tools.presence.claude}
                  onCheckTools={tools.recheck}
                />
              ) : null}
              {currentId === 'cloud' ? <WorkspaceSetupCloudStep live={live} /> : null}
              {currentId === 'project' ? (
                <WorkspaceSetupProjectStep
                  status={live.statuses.project}
                  location={location}
                  onLocationChange={flow.setLocation}
                />
              ) : null}
              {currentId === 'github' ? (
                <WorkspaceSetupGithubStep status={live.statuses.github} />
              ) : null}
              {isFinish ? (
                <WorkspaceSetupFinishStep
                  summary={setupSummary(live.statuses, flow.progress)}
                  onOpenStep={flow.jumpTo}
                />
              ) : null}
            </div>
          </div>

          <footer className="mt-4 flex flex-none flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {index > firstShown ? (
              <button type="button" className={quietButton} onClick={flow.back}>
                <ChevronLeft className="size-4" />
                {translate('auto.components.onboarding.OnboardingFooter.ba58547306', 'Back')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isFinish && hasProject ? (
                <button type="button" className={quietButton} onClick={flow.finish}>
                  {translate('components.onboarding.workspace.finish.done', 'Finish')}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                onClick={flow.next}
              >
                {primaryLabel}
                <CornerDownLeft className="size-3.5 opacity-70" aria-hidden />
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}
