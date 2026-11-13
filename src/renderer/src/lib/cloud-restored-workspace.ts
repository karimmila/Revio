import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { structuredLaunchOwner } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { parseExecutionHostId } from '../../../shared/execution-host'
import type { ArchivedChat } from '../../../shared/revio-archive-types'
import { reopenArchivedChats } from './revio-archive-chats'

/** The cloud workspaces now listed on this branch, to tell a new one from those already there. */
export function cloudWorktreeIdsOnBranch(branch: string): Set<string> {
  const ref = `refs/heads/${branch}`
  return new Set(
    Object.values(selectWorktreesByRepo(useAppStore.getState()))
      .flatMap((worktrees) => worktrees ?? [])
      .filter(
        (worktree) =>
          worktree.branch === ref &&
          parseExecutionHostId(worktree.hostId ?? null)?.kind === 'runtime'
      )
      .map((worktree) => worktree.id)
  )
}

const SETTLE_MS = 15 * 60_000
const GONE_GRACE_MS = 10_000

/**
 * The id of the cloud workspace a background create made on this branch, once that create
 * settles; null when it failed, was dismissed or never listed one.
 */
export function settledCloudWorktree(
  creationId: string,
  branch: string,
  before: ReadonlySet<string>
): Promise<string | null> {
  const startedAt = Date.now()
  let goneAt: number | null = null
  // A dismissed creation may finish listing its worktree a moment after it goes.
  const outcome = (): string | null | undefined => {
    const creation = useAppStore.getState().pendingWorktreeCreations[creationId]
    const made = [...cloudWorktreeIdsOnBranch(branch)].find((id) => !before.has(id))
    if (made && (!creation || creation.worktreeId === made)) {
      return made
    }
    goneAt = creation ? null : (goneAt ?? Date.now())
    const gone = goneAt !== null && Date.now() - goneAt > GONE_GRACE_MS
    const timedOut = Date.now() - startedAt > SETTLE_MS
    return creation?.status === 'error' || gone || timedOut ? null : undefined
  }
  return new Promise((resolve) => {
    const cleanup: (() => void)[] = []
    const check = (): void => {
      const result = outcome()
      if (result !== undefined) {
        cleanup.forEach((stop) => stop())
        resolve(result)
      }
    }
    cleanup.push(useAppStore.subscribe(check))
    const poll = setInterval(check, 1000)
    cleanup.push(() => clearInterval(poll))
    check()
  })
}

const OWNER_WAIT_MS = 60_000

/**
 * A new cloud workspace's chats come back once its server can take them. A restore from the
 * archived sandbox's snapshot usually keeps the workspace id and the chats' own records, so each
 * chat reopens by its record (adopting its conversation in a new chat would be refused while that
 * record holds it); one whose record is gone, or a workspace with a new id, resumes from the
 * provider conversation.
 */
export async function resumeChatsInCloudWorkspace(
  worktreeId: string,
  archivedWorkspaceId: string,
  chats: readonly ArchivedChat[]
): Promise<void> {
  const deadline = Date.now() + OWNER_WAIT_MS
  while (
    !structuredLaunchOwner({ route: 'structured-native-chat' }, worktreeId) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (chats.length > 0) {
    await reopenArchivedChats(worktreeId, archivedWorkspaceId, chats)
  }
}
