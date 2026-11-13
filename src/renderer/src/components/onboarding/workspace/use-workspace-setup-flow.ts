import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import type { OnboardingState } from '../../../../../shared/onboarding-state-types'
import {
  EMPTY_WORKSPACE_SETUP_PROGRESS,
  type WorkspaceSetupProgress
} from '../../../../../shared/workspace-setup'
import { agentSurfaceSettingsUpdate } from '../onboarding-flow-state'
import {
  firstOpenIndexFrom,
  neighbourIndex,
  recordStep,
  statusesSettled,
  stepIdAt,
  WORKSPACE_SETUP_LAST_INDEX,
  type SetupLocation
} from './workspace-setup-steps'
import { useWorkspaceSetupStatuses } from './use-workspace-setup-statuses'

function saveFailed(error: unknown): void {
  toast.error(
    translate(
      'auto.components.onboarding.use.onboarding.flow.52acfbef51',
      'Could not save progress'
    ),
    { description: error instanceof Error ? error.message : String(error) }
  )
}

export function useWorkspaceSetupFlow(
  onboarding: OnboardingState,
  onOnboardingChange: (state: OnboardingState) => void
) {
  const live = useWorkspaceSetupStatuses()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const hasProject = useAppStore((s) => s.repos.length > 0)
  const location: SetupLocation = settings?.revioLocation === 'cloud' ? 'cloud' : 'local'
  const [progress, setProgress] = useState<WorkspaceSetupProgress>(
    () => onboarding.workspaceSetup ?? EMPTY_WORKSPACE_SETUP_PROGRESS
  )
  const [index, setIndex] = useState(() =>
    Math.min(progress.lastCompletedStep + 1, WORKSPACE_SETUP_LAST_INDEX)
  )
  const navigatedRef = useRef(false)
  const resumedRef = useRef(false)
  const closingRef = useRef(false)
  const firstVisitRef = useRef(onboarding.workspaceSetup === undefined)

  // Once every status is known, a fresh flow skips past what this Mac already has connected.
  const settled = statusesSettled(live.statuses)
  useEffect(() => {
    if (!settled || resumedRef.current) {
      return
    }
    resumedRef.current = true
    if (!navigatedRef.current) {
      setIndex((current) => firstOpenIndexFrom(current, live.statuses))
    }
  }, [settled, live.statuses])

  // The fork drops upstream's Chat/Terminal question: chat is the default, switchable in Settings.
  useEffect(() => {
    if (!firstVisitRef.current || !settings) {
      return
    }
    firstVisitRef.current = false
    const update = agentSurfaceSettingsUpdate(settings, 'chat')
    if (Object.keys(update).length > 0) {
      void updateSettings(update)
    }
  }, [settings, updateSettings])

  const persist = useCallback(
    async (updates: Parameters<typeof window.api.onboarding.update>[0]): Promise<boolean> => {
      try {
        onOnboardingChange(await window.api.onboarding.update(updates))
        return true
      } catch (error) {
        saveFailed(error)
        return false
      }
    },
    [onOnboardingChange]
  )

  const currentId = stepIdAt(index)
  const advance = useCallback(
    (outcome: 'continue' | 'later') => {
      const nextProgress = recordStep(progress, index, outcome)
      setProgress(nextProgress)
      navigatedRef.current = true
      setIndex(neighbourIndex(index, 1))
      void persist({ workspaceSetup: nextProgress })
    },
    [index, persist, progress]
  )

  const close = useCallback(
    async (outcome: 'completed' | 'dismissed'): Promise<boolean> => {
      if (closingRef.current) {
        return false
      }
      closingRef.current = true
      const finalProgress =
        outcome === 'completed'
          ? recordStep(progress, WORKSPACE_SETUP_LAST_INDEX, 'continue')
          : progress
      const saved = await persist({
        closedAt: Date.now(),
        outcome,
        workspaceSetup: finalProgress,
        checklist: { dismissed: outcome === 'dismissed' }
      })
      if (!saved) {
        // A failed write did not close the flow; let the person try again.
        closingRef.current = false
      }
      return saved
    },
    [persist, progress]
  )

  const isConnected = currentId !== 'finish' && live.statuses[currentId] === 'connected'
  const createFirstWorkspace = async (): Promise<void> => {
    if (await close('completed')) {
      openWorkspaceCreationComposerWithTourHandoff()
    }
  }

  return {
    live,
    index,
    currentId,
    progress,
    location,
    isConnected,
    setLocation: (next: SetupLocation) => void updateSettings({ revioLocation: next }),
    /** Continue on a connected step, Set up later on one that is not; on the last, create or finish. */
    next: () => {
      if (currentId !== 'finish') {
        advance(isConnected ? 'continue' : 'later')
      } else if (hasProject) {
        void createFirstWorkspace()
      } else {
        void close('completed')
      }
    },
    later: () => (currentId === 'finish' ? void close('completed') : advance('later')),
    back: () => {
      navigatedRef.current = true
      setIndex((current) => neighbourIndex(current, -1))
    },
    jumpTo: (target: number) => {
      navigatedRef.current = true
      setIndex(target)
    },
    finish: () => void close('completed'),
    dismiss: () => void close('dismissed')
  }
}

export type WorkspaceSetupFlow = ReturnType<typeof useWorkspaceSetupFlow>
