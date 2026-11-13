import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { runBackgroundWorktreeCreation } from '@/lib/workspace/creation/worktree-creation-flow'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import { assertCloudWorkspaceReady } from '@/lib/cloud-workspace-preflight'
import { getRepoWorkspaceCreationTargetHint } from '@/lib/project-host-workspace-target'
import { cloudRestoreRequest } from './revio-cloud-unarchive'
import {
  cloudWorktreeIdsOnBranch,
  resumeChatsInCloudWorkspace,
  settledCloudWorktree
} from './cloud-restored-workspace'
import type {
  AsleepCloudWakeChanges,
  AsleepCloudWorkspace
} from '../../../shared/asleep-cloud-workspace-types'
import type { ArchivedChat } from '../../../shared/revio-archive-types'
import {
  dismissAsleepCloudConnectNotice,
  showAsleepCloudConnectNotice
} from './asleep-cloud-connect-notice'
import {
  clearAsleepCloudWaking,
  markAsleepCloudWaking,
  refreshAsleepCloudWorkspaces
} from './asleep-cloud-workspaces'

export type AsleepCloudWakeDeps = {
  /** False when Vercel is not connected; the wake then stops at Home's "Connect Vercel" card. */
  vercelConnected?: () => Promise<boolean>
  assertReady: (repoId: string) => Promise<void>
  prepareWake: (id: string) => Promise<AsleepCloudWorkspace>
  finishWake: (id: string) => Promise<AsleepCloudWakeChanges | null>
  create: (request: WorktreeCreationRequest) => string
  /** Resolves the new workspace's id once its creation settles; null when it failed or was dismissed. */
  settled: (
    creationId: string,
    branch: string,
    before: ReadonlySet<string>
  ) => Promise<string | null>
  resumeChats: (worktreeId: string, record: AsleepCloudWorkspace) => Promise<void>
  notify: (record: AsleepCloudWorkspace, changes: AsleepCloudWakeChanges) => void
}

/**
 * Opens an imported cloud workspace: its sandbox starts from the repository's build on the
 * workspace's commit, gets its uncommitted work, and its chats resume there. The row reads as
 * the creation's "Setting up…" meanwhile. A failed or dismissed wake keeps the workspace asleep,
 * with everything it kept, so it can be opened again.
 */
export async function wakeAsleepCloudWorkspace(
  record: AsleepCloudWorkspace,
  deps: AsleepCloudWakeDeps = defaultDeps
): Promise<boolean> {
  const repo = useAppStore.getState().repos.find((candidate) => candidate.id === record.repoId)
  if (!repo || !markAsleepCloudWaking(record.id)) {
    return false
  }
  if ((await deps.vercelConnected?.().catch(() => true)) === false) {
    clearAsleepCloudWaking(record.id)
    // Home lists the workspace and holds the card, so the reason shows where the click was read.
    const state = useAppStore.getState()
    state.setActiveView('terminal')
    state.setActiveWorktree(null)
    showAsleepCloudConnectNotice(record)
    return false
  }
  dismissAsleepCloudConnectNotice()
  try {
    // No build yet: this says so, with the button to fix it; it stays asleep.
    await deps.assertReady(record.repoId)
  } catch {
    clearAsleepCloudWaking(record.id)
    return false
  }
  try {
    await deps.prepareWake(record.id)
  } catch (error) {
    clearAsleepCloudWaking(record.id)
    toast.error(
      translate('auto.lib.asleepCloudWake.failed', 'Could not open {{value0}}', {
        value0: record.displayName
      }),
      { description: error instanceof Error ? error.message : String(error) }
    )
    return false
  }
  const before = cloudWorktreeIdsOnBranch(record.branch)
  const { projectId } = getRepoWorkspaceCreationTargetHint(
    repo,
    useAppStore.getState().projectHostSetups
  )
  const creationId = deps.create(cloudRestoreRequest(record, record.branch, projectId, repo))
  const worktreeId = await deps.settled(creationId, record.branch, before)
  if (!worktreeId) {
    clearAsleepCloudWaking(record.id)
    return false
  }
  await deps.resumeChats(worktreeId, record)
  const changes = await deps.finishWake(record.id).catch(() => null)
  clearAsleepCloudWaking(record.id)
  if (changes) {
    deps.notify(record, changes)
  }
  return true
}

/** The chats start once the workspace's server can take them. */
async function resumeChats(worktreeId: string, record: AsleepCloudWorkspace): Promise<void> {
  // An imported workspace never had a chat record here: its chats resume from the provider.
  const chats: ArchivedChat[] = record.chats.map((chat) => ({
    agent: chat.agent,
    providerSessionId: chat.providerSessionId,
    ...(chat.title ? { title: chat.title } : {})
  }))
  await resumeChatsInCloudWorkspace(worktreeId, record.id, chats)
}

function notify(record: AsleepCloudWorkspace, changes: AsleepCloudWakeChanges): void {
  if (changes === 'kept-aside') {
    toast.warning(
      translate(
        'auto.lib.asleepCloudWake.keptAside',
        'The uncommitted changes of {{value0}} did not apply; they are in .revio-import.',
        { value0: record.displayName }
      )
    )
  }
}

const defaultDeps: AsleepCloudWakeDeps = {
  vercelConnected: async () => (await window.api.vercelCloud?.status())?.state === 'connected',
  assertReady: assertCloudWorkspaceReady,
  prepareWake: async (id) => {
    const api = window.api?.workspaceImport
    if (!api) {
      throw new Error('Unavailable')
    }
    return api.prepareWake(id)
  },
  finishWake: async (id) => {
    const changes = (await window.api?.workspaceImport?.finishWake(id)) ?? null
    void refreshAsleepCloudWorkspaces()
    return changes
  },
  create: runBackgroundWorktreeCreation,
  settled: settledCloudWorktree,
  resumeChats,
  notify
}
