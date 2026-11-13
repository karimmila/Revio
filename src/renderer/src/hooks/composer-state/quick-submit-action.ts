import { useCallback } from 'react'
import { cloudCreateBlock } from '@/lib/cloud-create-guard'
import { translate } from '@/i18n/i18n'
import { cloudReadinessNow, rememberCloudRepo } from '@/lib/cloud-readiness'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import type { QuickSubmitOptions } from './quick-creation-request'
import { findPendingLinkedWorkItemCreationId } from '@/lib/workspace/creation/pending-worktree-creation'
import { useAppStore } from '@/store'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { settleComposerSubmit } from '@/lib/composer-submit-cancellation'
import {
  formatWorkspaceCreateError,
  getWorkspaceCreateErrorToastMessage
} from '@/lib/workspace-create-error-format'
import { toast } from 'sonner'
import { scheduleComposerCreateHandoff } from '@/lib/composer-create-handoff'

import type { ComposerModel } from './composer-model'

type QuickSubmitActionInput = Pick<
  ComposerModel,
  | 'effectiveLinkedPR'
  | 'executeQuickCreation'
  | 'fallbackCreatureName'
  | 'isProjectGroupTarget'
  | 'isSubmissionCancelled'
  | 'linkedPR'
  | 'linkedWorkItem'
  | 'name'
  | 'onCreated'
  | 'parsedLinkedIssueNumber'
  | 'repoId'
  | 'requiresExplicitSetupChoice'
  | 'resolvePendingSmartGitHubSubmit'
  | 'selectedRepo'
  | 'selectedRepoRequiresConnection'
  | 'selectedWorkspaceTarget'
  | 'setCreateError'
  | 'setCreating'
  | 'setupDecision'
  | 'showProjectRequiredError'
  | 'sourceIntentBlocksCreate'
  | 'sparseError'
  | 'submitFolderTarget'
  | 'taskSourceContext'
  | 'telemetrySource'
  | 'agentPrompt'
  | 'settings'
>

export function useQuickSubmitAction(input: QuickSubmitActionInput) {
  const {
    effectiveLinkedPR,
    executeQuickCreation,
    fallbackCreatureName,
    isProjectGroupTarget,
    isSubmissionCancelled,
    linkedPR,
    linkedWorkItem,
    name,
    onCreated,
    parsedLinkedIssueNumber,
    repoId,
    requiresExplicitSetupChoice,
    resolvePendingSmartGitHubSubmit,
    selectedRepo,
    selectedRepoRequiresConnection,
    selectedWorkspaceTarget,
    setCreateError,
    setCreating,
    setupDecision,
    showProjectRequiredError,
    sourceIntentBlocksCreate,
    sparseError,
    submitFolderTarget,
    taskSourceContext,
    telemetrySource,
    agentPrompt,
    settings
  } = input

  const submitQuick = useCallback(
    async (requestedAgent: TuiAgent | null, options?: QuickSubmitOptions): Promise<void> => {
      // In the Cloud location Create makes a cloud workspace or nothing: a repository that cannot
      // run there (or a project group) is refused with the reason, never created on this Mac.
      const liveSettings = useAppStore.getState().settings
      if (liveSettings?.revioLayout === true && liveSettings.revioLocation === 'cloud') {
        const block = isProjectGroupTarget
          ? {
              reason: translate(
                'auto.hooks.composerState.cloudCreate.projectGroup',
                'Project groups run on this Mac only. Pick a GitHub repository.'
              )
            }
          : cloudCreateBlock(selectedRepo, cloudReadinessNow())
        if (block) {
          setCreateError({
            title: translate(
              'auto.hooks.composerState.cloudCreate.title',
              'Can’t create a cloud workspace'
            ),
            message: block.reason
          })
          return
        }
        if (selectedRepo) {
          rememberCloudRepo(selectedRepo.id)
        }
      }
      if (isProjectGroupTarget) {
        await submitFolderTarget(requestedAgent, options)
        return
      }

      const prompt =
        options?.prompt ?? (settings?.promptFirstWorkspaceComposer === true ? agentPrompt : '')
      const workspaceNameSeed = getWorkspaceSeedName({
        explicitName: name,
        prompt: promptNameSeed(prompt),
        linkedIssueNumber: parsedLinkedIssueNumber,
        linkedPR,
        fallbackName: fallbackCreatureName
      })

      if (!repoId || !selectedRepo) {
        showProjectRequiredError()
        return
      }

      if (
        !workspaceNameSeed ||
        sourceIntentBlocksCreate ||
        selectedRepoRequiresConnection ||
        (requiresExplicitSetupChoice && !setupDecision) ||
        sparseError !== null
      ) {
        return
      }

      const workspaceRunContext: WorktreeCreationRequest['workspaceRunContext'] =
        selectedWorkspaceTarget.status === 'ready'
          ? {
              kind: 'workspace-run',
              projectId: selectedWorkspaceTarget.target.projectId,
              hostId: selectedWorkspaceTarget.target.hostId,
              projectHostSetupId: selectedWorkspaceTarget.target.projectHostSetupId,
              repoId: selectedWorkspaceTarget.target.repoId,
              path: selectedWorkspaceTarget.target.repo.path
            }
          : null

      const liveStore = useAppStore.getState()

      const pendingCreationId = findPendingLinkedWorkItemCreationId(
        liveStore.pendingWorktreeCreations,
        {
          repoId,
          ...(parsedLinkedIssueNumber != null ? { linkedIssue: parsedLinkedIssueNumber } : {}),
          ...(effectiveLinkedPR != null ? { linkedPR: effectiveLinkedPR } : {}),
          workspaceRunContext
        }
      )

      if (pendingCreationId) {
        liveStore.updatePendingWorktreeCreation(pendingCreationId, { loaderVisible: true })
        liveStore.setActivePendingWorktreeCreation(pendingCreationId)
        liveStore.setActiveView('terminal')
        liveStore.setSidebarOpen(true)
        onCreated?.()
        return
      }

      setCreateError(null)

      setCreating(true)
      const handoff = scheduleComposerCreateHandoff({
        stagingRequest: {
          repoId,
          workspaceRunContext,
          name: workspaceNameSeed,
          ...(parsedLinkedIssueNumber != null ? { linkedIssue: parsedLinkedIssueNumber } : {}),
          ...(effectiveLinkedPR != null ? { linkedPR: effectiveLinkedPR } : {}),
          setupDecision: setupDecision ?? 'inherit',
          agent: requestedAgent,
          pendingFirstAgentMessageRename: false,
          note: '',
          startupPlan: null,
          quickPrompt: '',
          quickTelemetry: null
        },
        // Why: closing (even under "Create more") keeps a later dismiss from cancelling this submit.
        onHandOff: () => onCreated?.(),
        isCancelled: isSubmissionCancelled,
        reopenComposer: () =>
          useAppStore.getState().openModal('new-workspace-composer', {
            prefilledName: name,
            initialRepoId: repoId,
            linkedWorkItem,
            taskSourceContext,
            telemetrySource
          })
      })
      try {
        const smartGitHubSettlement = await settleComposerSubmit(
          resolvePendingSmartGitHubSubmit(),
          isSubmissionCancelled
        )
        if (smartGitHubSettlement.status === 'cancelled') {
          return
        }
        await executeQuickCreation(
          smartGitHubSettlement.value,
          requestedAgent,
          workspaceNameSeed,
          workspaceRunContext,
          repoId,
          { ...options, prompt },
          handoff
        )
      } catch (error) {
        if (isSubmissionCancelled()) {
          return
        }
        const formattedError = formatWorkspaceCreateError(error)
        if (handoff.fail(getWorkspaceCreateErrorToastMessage(formattedError))) {
          return
        }
        setCreateError(formattedError)
        toast.error(getWorkspaceCreateErrorToastMessage(formattedError))
      } finally {
        handoff.dispose()
        setCreating(false)
      }
    },
    [
      effectiveLinkedPR,
      executeQuickCreation,
      fallbackCreatureName,
      isProjectGroupTarget,
      isSubmissionCancelled,
      linkedPR,
      linkedWorkItem,
      name,
      onCreated,
      parsedLinkedIssueNumber,
      repoId,
      requiresExplicitSetupChoice,
      resolvePendingSmartGitHubSubmit,
      selectedRepo,
      selectedRepoRequiresConnection,
      selectedWorkspaceTarget,
      setCreateError,
      setCreating,
      setupDecision,
      showProjectRequiredError,
      sourceIntentBlocksCreate,
      sparseError,
      submitFolderTarget,
      taskSourceContext,
      telemetrySource,
      agentPrompt,
      settings
    ]
  )

  return { submitQuick }
}

/** The first sentence's first five words, so a long prompt still yields a short, readable name. */
export function promptNameSeed(prompt: string | undefined): string {
  const firstSentence = (prompt ?? '').trim().split(/[\n.!?]/)[0] ?? ''
  return firstSentence
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
}
