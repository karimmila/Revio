import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'

type Place =
  | { kind: 'local'; worktreePath: string }
  | { kind: 'runtime'; environmentId: string; worktreeId: string }

// A save that takes longer than this lets the message go anyway; a turn is never held up for long.
const SAVE_WAIT_MS = 4000

/** Where a chat's workspace lives: its own tab names it. SSH workspaces have no checkpoints. */
function placeOfSession(sessionId: string): Place | null {
  const state = useAppStore.getState()
  const worktreeId = Object.entries(state.unifiedTabsByWorktree ?? {}).find(([, tabs]) =>
    tabs.some((tab) => tab.contentType === 'agent-session' && tab.entityId === sessionId)
  )?.[0]
  const worktree = worktreeId ? findWorktreeById(selectWorktreesByRepo(state), worktreeId) : null
  const repo = worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : null
  if (!worktree || !repo) {
    return null
  }
  const environmentId = runtimeEnvironmentIdOrLocalUnlessTwin(state, worktree.id)
  if (environmentId) {
    return { kind: 'runtime', environmentId, worktreeId: worktree.id }
  }
  return repo.connectionId ? null : { kind: 'local', worktreePath: worktree.path }
}

/**
 * The checkpoints: before each message the workspace layout keeps the workspace's files
 * as they are, so a later rewind can put them back. Never blocks a send for long or fails it.
 */
export async function saveTurnCheckpointForSession(sessionId: string): Promise<void> {
  if (useAppStore.getState().settings?.revioLayout !== true) {
    return
  }
  const place = placeOfSession(sessionId)
  if (!place) {
    return
  }
  const save =
    place.kind === 'local'
      ? window.api.turnCheckpoints?.save({ worktreePath: place.worktreePath, sessionId })
      : callRuntimeRpc(
          { kind: 'environment', environmentId: place.environmentId },
          'git.turnCheckpointSave',
          { worktree: toRuntimeWorktreeSelector(place.worktreeId), sessionId },
          { timeoutMs: SAVE_WAIT_MS }
        )
  await Promise.race([
    Promise.resolve(save).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, SAVE_WAIT_MS))
  ])
}

/** Puts the workspace's files back as they were before the message seen at `before`. */
export async function restoreTurnCheckpointForSession(
  sessionId: string,
  before: number
): Promise<boolean> {
  const place = placeOfSession(sessionId)
  if (!place) {
    return false
  }
  if (place.kind === 'local') {
    return (
      (await window.api.turnCheckpoints?.restore({
        worktreePath: place.worktreePath,
        sessionId,
        before
      })) ?? false
    )
  }
  return callRuntimeRpc<boolean>(
    { kind: 'environment', environmentId: place.environmentId },
    'git.turnCheckpointRestore',
    { worktree: toRuntimeWorktreeSelector(place.worktreeId), sessionId, before },
    { timeoutMs: 60_000 }
  )
}
