import {
  activateAndRevealFolderWorkspace,
  activateAndRevealWorktree
} from '@/lib/workspace/activation/worktree-activation'
import { parseWorkspaceKey } from '../../../shared/workspace-scope'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ExecutionHostId } from '../../../shared/execution-host'
import { armCloudWakeTyping, disarmCloudWakeTyping } from './cloud-wake-typing'
import { startBoundedRetry } from './bounded-retry'

/** About 20s in all, front-loaded: the VM's server usually answers within the first seconds. */
const VM_WAKE_PTY_RETRY_DELAYS_MS = [0, 1_000, 1_000, 2_000, 2_000, 4_000, 4_000, 6_000]
const wakeRetryCancels = new Map<string, () => void>()

export async function activateWorktreeFromSidebar(
  worktreeId: string,
  executionHostId?: ExecutionHostId,
  options?: { revealInSidebar?: boolean }
): Promise<void> {
  const workspaceScope = parseWorkspaceKey(worktreeId)
  if (workspaceScope?.type === 'folder') {
    activateAndRevealFolderWorkspace(workspaceScope.folderWorkspaceId, {
      navigationIntent: 'user-open',
      ...options,
      ...(executionHostId ? { executionHostId } : {})
    })
    return
  }
  // Keep navigation independent from an optional runtime wake IPC.
  activateAndRevealWorktree(worktreeId, {
    navigationIntent: 'user-open',
    revealInSidebar: false,
    ...(executionHostId ? { executionHostId } : {})
  })

  await resumeEphemeralVmWorkspace(worktreeId)
}

/** Wakes the per-workspace VM behind a worktree, if it has one. */
async function resumeEphemeralVmWorkspace(worktreeId: string): Promise<void> {
  if (typeof window === 'undefined' || !window.api?.ephemeralVm?.resumeWorkspace) {
    return
  }
  // Sent before resume, so main answers with the status from before the wake.
  void window.api.ephemeralVm
    .listRuntimes?.()
    .then((runtimes) => {
      const asleep = runtimes.some(
        (entry) =>
          entry.workspaceId === worktreeId &&
          (entry.status === 'suspended' || entry.status === 'resume_failed')
      )
      if (asleep) {
        armCloudWakeTyping(worktreeId)
      }
    })
    .catch(() => undefined)
  try {
    const runtime = await window.api.ephemeralVm.resumeWorkspace({ workspaceId: worktreeId })
    if (runtime?.runtimeEnvironmentId) {
      const store = (await import('@/store')).useAppStore
      store.getState().setRuntimeEnvironments(await window.api.runtimeEnvironments.list())
      await store.getState().refreshRuntimeEnvironmentStatus(runtime.runtimeEnvironmentId)
      // The VM is back, but open terminals may sit in a 15-30 s reconnect backoff. Nudge them
      // while the VM's Orca server restarts, one timer at a time, and stop once none waits.
      const { hasScheduledRemoteRuntimePtyRecoveries, retryAllRemoteRuntimePtyRecoveriesNow } =
        await import('@/components/terminal-pane/pty-transport/remote-runtime/recovery/remote-runtime-pty-recovery-state')
      wakeRetryCancels.get(worktreeId)?.()
      wakeRetryCancels.set(
        worktreeId,
        startBoundedRetry({
          delaysMs: VM_WAKE_PTY_RETRY_DELAYS_MS,
          attempt: () => void retryAllRemoteRuntimePtyRecoveriesNow(),
          isDone: () => !hasScheduledRemoteRuntimePtyRecoveries()
        })
      )
    }
  } catch (error) {
    disarmCloudWakeTyping(worktreeId)
    toast.error(
      translate(
        'auto.lib.sidebarWorktreeActivation.wakeEphemeralVmFailed',
        'Failed to wake ephemeral VM workspace'
      ),
      {
        // Electron wraps main's message in "Error invoking remote method …"; the person needs the reason.
        description: (error instanceof Error ? error.message : String(error)).replace(
          /^Error invoking remote method '[^']+': (Error: )?/,
          ''
        )
      }
    )
  }
}
