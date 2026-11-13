import { quotePosixShell } from '../../../../shared/shell/launch/shell-argument-quoting'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import { useAppStore } from '@/store'
import { isWindowsUserAgent } from '@/lib/user-agent-platform'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { translate } from '@/i18n/i18n'
import {
  CLOUD_DOCK_CLOSED_COMMAND,
  CLOUD_DOCK_SSH_OPTIONS
} from '../../../../shared/cloud/cloud-dock-line'

/**
 * The workspace layout puts a workspace's Setup and Run in its bottom panel. Orca's dock is its
 * floating terminal workspace, whose terminals only run on this Mac, so a cloud workspace's dock
 * tab is a terminal here running the workspace's own ssh route (its key, proxy and pinned host key,
 * the same line as "Copy SSH command") with the command for the sandbox. Nothing secret is added:
 * the key stays in Orca's data folder and the sandbox sees the session as any terminal of its own.
 *
 * The ssh line is read from main before each use (`prepareCloudDock`), because creating a dock
 * tab is synchronous and a sandbox's route is only known while it runs.
 */
const sshLines = new Map<string, string>()

const SANDBOX_CONNECTION_CLOSED = '[The sandbox connection closed. Run again to reconnect.]'

export function cloudEnvironmentIdOfRepo(
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | undefined
): string | null {
  const host = repo ? parseExecutionHostId(getRepoExecutionHostId(repo)) : null
  return host?.kind === 'runtime' ? host.environmentId : null
}

/** Reads the running sandbox's ssh line; false when it has none (not a cloud workspace, asleep). */
export async function prepareCloudDock(environmentId: string | null): Promise<boolean> {
  if (!environmentId || typeof window.api.cloud?.sshCommand !== 'function') {
    return false
  }
  const line = await window.api.cloud.sshCommand(environmentId).catch(() => null)
  if (line) {
    sshLines.set(environmentId, line)
  } else {
    sshLines.delete(environmentId)
  }
  return line !== null
}

/** `prepareCloudDock` for the workspace's sandbox, when it runs in one. */
export function prepareCloudDockForWorktree(worktreeId: string): Promise<boolean> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  return prepareCloudDock(cloudEnvironmentIdOfRepo(repo ?? undefined))
}

export function cloudDockSshLine(environmentId: string | null): string | null {
  return environmentId ? (sshLines.get(environmentId) ?? null) : null
}

/**
 * The line the dock's local shell runs: ssh with a terminal (`-t`, so ⌃C and colours reach the
 * sandbox), into the workspace's checkout, the command, then an interactive shell so the tab
 * stays usable once the command ends, as a dock tab on this Mac does. Null for a line that is not
 * the plain `ssh …` Orca builds.
 */
export function cloudDockCommand(
  sshLine: string,
  remoteDir: string,
  command: string
): string | null {
  if (!sshLine.startsWith('ssh ')) {
    return null
  }
  const remote = `cd ${quotePosixShell(remoteDir)} 2>/dev/null; ${command}; exec bash -l`
  const connecting = translate(
    'auto.components.revioLayout.cloudDockConnecting',
    'Connecting to the sandbox…'
  )
  // The leading space keeps the long line out of this Mac's shell history. When ssh ends (the
  // sandbox slept or was archived) the tab keeps its log but never falls back to a prompt on this
  // Mac, which looked like the sandbox's shell (seen 2026-11-10 after a wake). The tab says it is
  // connecting first, and the timeouts end a session whose route never answers: one that hung
  // there showed nothing but the keys typed into it, echoed by this Mac's terminal.
  return ` printf '\\033[2m%s\\033[0m\\n' ${quotePosixShell(connecting)}; ssh -t ${CLOUD_DOCK_SSH_OPTIONS} ${sshLine.slice('ssh '.length)} ${quotePosixShell(remote)}; printf '\\n%s\\n' ${quotePosixShell(SANDBOX_CONNECTION_CLOSED)}; exec ${CLOUD_DOCK_CLOSED_COMMAND}`
}

/** What a dock tab of this workspace starts with, or null when the dock cannot run the command. */
export function dockTabStartup(
  worktree: { path: string },
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | undefined,
  remote: boolean,
  command: string,
  env: Record<string, string> | undefined
): {
  startupCwd?: string
  pendingStartup: { command: string; env?: Record<string, string> }
} | null {
  if (!remote) {
    return { startupCwd: worktree.path, pendingStartup: env ? { command, env } : { command } }
  }
  // Variables given here would apply to this Mac's shell, not the sandbox's.
  if (env && Object.keys(env).length > 0) {
    return null
  }
  const sshLine = cloudDockSshLine(cloudEnvironmentIdOfRepo(repo))
  const cloudCommand = sshLine ? cloudDockCommand(sshLine, worktree.path, command) : null
  return cloudCommand ? { pendingStartup: { command: cloudCommand } } : null
}

// The shell echoes the line that starts a dock command (for a long one, `. '/var/folders/…/
// orca-launch-….sh'`), which is Orca's plumbing; clearing first leaves only the command's output.
export function withCleanScreen<T extends { pendingStartup: { command: string } }>(
  startup: T | null
): T | null {
  if (!startup || isWindowsUserAgent()) {
    return startup
  }
  return {
    ...startup,
    pendingStartup: {
      ...startup.pendingStartup,
      command: ` printf '\\033[H\\033[2J\\033[3J'; ${startup.pendingStartup.command}`
    }
  }
}
