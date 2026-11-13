import { cloudCreateTimingLine } from '../../../shared/cloud/cloud-create-timing'
import { toast } from 'sonner'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import { useAppStore } from '@/store'
import { prepareEphemeralVmWorkspaceTarget } from '@/lib/ephemeral-vm-workspace-target'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import { getProjectIdentityKey } from '../../../shared/project-host-setup-projection'
import type { Repo } from '../../../shared/repo-types'
import { translate } from '@/i18n/i18n'
import { prefixedBranchName } from '../../../shared/git/branches/branch-prefix'
import { cleanupFailedEphemeralVmWorkspace } from '@/lib/ephemeral-vm-failed-create-cleanup'
import {
  appendProvisioningLog,
  appendProvisioningWarnings
} from '@/lib/pending-creation-provisioning-log'

export async function prepareRequestForCreate(
  creationId: string,
  request: WorktreeCreationRequest
): Promise<WorktreeCreationRequest | null> {
  if (request.ephemeralVmRecipe && !request.ephemeralVmRuntimeId) {
    return prepareEphemeralVmRecipeRequest(creationId, request, request.ephemeralVmRecipe)
  }
  return request
}

async function prepareEphemeralVmRecipeRequest(
  creationId: string,
  request: WorktreeCreationRequest,
  recipe: NonNullable<WorktreeCreationRequest['ephemeralVmRecipe']>
): Promise<WorktreeCreationRequest | null> {
  const store = useAppStore.getState()
  if (recipe.checkoutMode === 'provisioned-root' && request.sparseCheckout) {
    store.updatePendingWorktreeCreation(creationId, {
      status: 'error',
      error: getProvisionedRootSparseCheckoutError()
    })
    return null
  }
  store.updatePendingWorktreeCreation(creationId, {
    phase: 'provisioning-vm',
    provisioningLog: ''
  })
  const unsubscribeProvisionEvents = window.api.ephemeralVm.onProvisionEvent?.((event) => {
    if (event.provisionId !== creationId || event.stream !== 'stderr') {
      return
    }
    appendProvisioningLog(creationId, event.chunk)
  })
  let preparedTarget: Awaited<ReturnType<typeof prepareEphemeralVmWorkspaceTarget>>
  const sourceRepo = store.repos.find((repo) => repo.id === recipe.sourceRepoId)
  // The recipe checks this branch out and the host then adopts it by name, so both get the same one.
  const provisionedBranch =
    request.branchNameOverride ??
    prefixedBranchName(
      request.name,
      {
        branchPrefix: store.settings?.branchPrefix ?? 'none',
        branchPrefixCustom: store.settings?.branchPrefixCustom
      },
      sourceRepo?.gitUsername ?? null
    )
  try {
    preparedTarget = await prepareEphemeralVmWorkspaceTarget({
      repoId: recipe.sourceRepoId,
      recipeId: recipe.recipeId,
      projectId: resolvePortableEphemeralVmProjectId(sourceRepo) ?? recipe.projectId,
      workspaceName: request.name,
      ...(recipe.checkoutMode === 'provisioned-root'
        ? {
            branch: provisionedBranch,
            ...(request.baseBranch ? { ref: request.baseBranch } : {})
          }
        : {}),
      provisionId: creationId,
      setupExistingFolder: (args) => store.setupProjectExistingFolder(args, { announce: false })
    })
  } finally {
    unsubscribeProvisionEvents?.()
  }
  if (!preparedTarget.ok) {
    if (!useAppStore.getState().pendingWorktreeCreations[creationId]) {
      return null
    }
    useAppStore.getState().updatePendingWorktreeCreation(creationId, {
      status: 'error',
      error: preparedTarget.error
    })
    if (useAppStore.getState().activePendingCreationId !== creationId) {
      toast.error(preparedTarget.error)
    }
    return null
  }
  appendProvisioningWarnings(creationId, preparedTarget.warnings)
  if (preparedTarget.environmentId) {
    // Why: the VM's first connect may have just deployed this server; host badges and removal read it.
    try {
      useAppStore.getState().setRuntimeEnvironments(await window.api.runtimeEnvironments.list())
    } catch {
      // A stale catalog only delays host badges; removal re-reads it.
    }
  }
  const preparedRequest: WorktreeCreationRequest = {
    ...request,
    repoId: preparedTarget.setup.repo.id,
    ...(preparedTarget.checkoutMode === 'provisioned-root'
      ? {
          baseBranch: request.baseBranch,
          compareBaseRef: request.compareBaseRef,
          branchNameOverride: provisionedBranch
        }
      : getEphemeralVmPortableBaseSelection(request)),
    ephemeralVmRuntimeId: preparedTarget.runtimeId,
    ephemeralVmCheckoutMode: preparedTarget.checkoutMode,
    ...(preparedTarget.expectedRefHead
      ? { ephemeralVmExpectedRefHead: preparedTarget.expectedRefHead }
      : {}),
    ...(preparedTarget.environmentId
      ? { ephemeralVmRuntimeEnvironmentId: preparedTarget.environmentId }
      : {}),
    workspaceRunContext: {
      kind: 'workspace-run',
      projectId: preparedTarget.setup.setup.projectId,
      hostId: preparedTarget.setup.setup.hostId,
      projectHostSetupId: preparedTarget.setup.setup.id,
      repoId: preparedTarget.setup.repo.id,
      path: preparedTarget.setup.repo.path
    }
  }
  if (!useAppStore.getState().pendingWorktreeCreations[creationId]) {
    await cleanupEphemeralVmRuntimeForFailedCreate(preparedRequest)
    return null
  }
  useAppStore.getState().updatePendingWorktreeCreation(creationId, {
    phase: 'fetching',
    request: preparedRequest
  })
  return preparedRequest
}

function getEphemeralVmPortableBaseSelection(
  request: WorktreeCreationRequest
): Pick<WorktreeCreationRequest, 'baseBranch' | 'compareBaseRef'> {
  const keepBaseBranch =
    request.linkedPR !== undefined ||
    request.linkedGitLabMR !== undefined ||
    request.linkedBitbucketPR !== undefined ||
    request.linkedAzureDevOpsPR !== undefined ||
    request.linkedGiteaPR !== undefined ||
    Boolean(request.compareBaseRef) ||
    Boolean(request.pushTarget) ||
    Boolean(request.branchNameOverride)
  if (keepBaseBranch) {
    return {
      ...(request.baseBranch ? { baseBranch: request.baseBranch } : {}),
      ...(request.compareBaseRef ? { compareBaseRef: request.compareBaseRef } : {})
    }
  }
  // A fresh VM checkout may lack source local/pinned branches; use its default unless the user chose a provider-backed start point.
  return { baseBranch: undefined, compareBaseRef: undefined }
}

/**
 * The created worktree becomes the creation's, or false when the creation was cancelled meanwhile.
 * The id goes on the pending creation at once: a runtime host sends no create progress, and the
 * sidebar swaps the pending row for the listed one as soon as it knows the id (it showed both
 * while the chat opened).
 */
export async function adoptCreatedWorktree(
  creationId: string,
  request: WorktreeCreationRequest,
  worktreeId: string
): Promise<boolean> {
  // Cancellation can race a successful backend adoption; clean up again after it settles so an
  // adopted workspace cannot outlive its destroyed VM.
  if (!useAppStore.getState().pendingWorktreeCreations[creationId]) {
    if (request.ephemeralVmRuntimeId) {
      await cleanupEphemeralVmRuntimeForFailedCreate(request)
    }
    return false
  }
  useAppStore.getState().updatePendingWorktreeCreation(creationId, { worktreeId })
  await attachEphemeralVmRuntimeToWorkspace(request, worktreeId, creationId)
  return true
}

export async function attachEphemeralVmRuntimeToWorkspace(
  request: WorktreeCreationRequest,
  workspaceId: string,
  creationId?: string
): Promise<void> {
  logWorkspaceCreateTiming(request, creationId)
  // Orca's cloud recipe attaches even its provisioned roots: sleep, wake and the session watch
  // find the sandbox through the workspace id on the runtime record.
  if (
    !request.ephemeralVmRuntimeId ||
    (request.ephemeralVmCheckoutMode === 'provisioned-root' &&
      request.ephemeralVmRecipe?.recipeId !== VERCEL_CLOUD_RECIPE_ID)
  ) {
    return
  }
  try {
    await window.api.ephemeralVm.attachWorkspace({
      runtimeId: request.ephemeralVmRuntimeId,
      workspaceId
    })
    if (request.ephemeralVmRuntimeEnvironmentId) {
      void useAppStore
        .getState()
        .refreshRuntimeEnvironmentStatus(request.ephemeralVmRuntimeEnvironmentId)
    }
  } catch (error) {
    console.error('Failed to attach ephemeral VM runtime to workspace:', error)
  }
}

// The workspace create starts when the creation leaves provisioning ("fetching" in its phase log).
function logWorkspaceCreateTiming(request: WorktreeCreationRequest, creationId?: string): void {
  const entry = creationId ? useAppStore.getState().pendingWorktreeCreations[creationId] : undefined
  const startedAt = entry?.phaseLog?.find((record) => record.phase === 'fetching')?.at
  if (creationId && request.ephemeralVmRuntimeId && startedAt !== undefined) {
    appendProvisioningLog(creationId, cloudCreateTimingLine('workspace', startedAt))
  }
}

function resolvePortableEphemeralVmProjectId(repo: Repo | undefined): string | null {
  if (!repo) {
    return null
  }
  // Reuse canonical github: identity but reject git:/repo: fallbacks to retain non-GitHub null behavior.
  const key = getProjectIdentityKey(repo)
  return key.startsWith('github:') ? key : null
}

export async function cleanupEphemeralVmRuntimeForFailedCreate(
  request: WorktreeCreationRequest
): Promise<void> {
  await cleanupFailedEphemeralVmWorkspace(request, {
    deleteProjectHostSetup: (setupId, hostId) =>
      useAppStore.getState().deleteProjectHostSetup({ setupId, hostId }),
    // A create that failed holds no work, so its cloud sandbox needs no restore point.
    cleanupRuntime: (runtimeId) =>
      window.api.ephemeralVm.cleanup({ runtimeId, discard: 'failed-create' }),
    reportSetupError: (error) =>
      console.error('Failed to remove provisioned-root project setup:', error),
    reportRuntimeError: (error) =>
      console.error(
        'Failed to clean up ephemeral VM runtime after workspace creation failed:',
        error
      )
  })
}

export function getProvisionedRootSparseCheckoutError(): string {
  return translate(
    'auto.lib.ephemeralVmWorktreeCreation.sparseCheckoutUnsupported',
    'Provisioned-root recipes do not support sparse checkout.'
  )
}
