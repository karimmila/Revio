import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { pullLatestAgentPrompt } from '../../../../shared/git/revio-pull-latest'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { launchRevioAgentChat } from './launch-revio-chat'

/** Git actions Orca's source-control panel runs; the Changes tab's status strip owns them. */
export type RevioGitAction = 'pull' | 'push' | 'rebase_base'

type Listener = (action: RevioGitAction) => boolean

let listener: Listener | null = null
let pending: RevioGitAction | null = null

/**
 * Runs a git action from a key or the PR bar. The strip that can run it lives in the Changes
 * tab, so the tab opens first and the action waits for the strip to mount.
 */
export function requestRevioGitAction(action: RevioGitAction): void {
  if (listener?.(action)) {
    return
  }
  pending = action
  const state = useAppStore.getState()
  state.setRightSidebarOpen(true)
  state.setRightSidebarTab('source-control')
}

/** The mounted strip registers here; a waiting action runs once it can. */
export function listenForRevioGitActions(run: Listener): () => void {
  listener = run
  if (pending && run(pending)) {
    pending = null
  }
  return () => {
    if (listener === run) {
      listener = null
    }
  }
}

/** "Commit and push": the agent commits with a message it writes, then pushes. */
export function commitAndPushWithAgent(worktreeId: string): void {
  launchRevioAgentChat(worktreeId, { prompt: 'Commit and push all changes.' })
}

/**
 * The remote line: a branch both ahead of and behind its remote has diverged (often a
 * rebase on one side), so Pull or Push alone would fail; the agent resolves it instead.
 */
export function remoteSyncState(
  ahead: number,
  behind: number
): 'incompatible' | 'behind' | 'ahead' | null {
  if (ahead > 0 && behind > 0) {
    return 'incompatible'
  }
  return behind > 0 ? 'behind' : ahead > 0 ? 'ahead' : null
}

export function resolveRemoteIncompatibilityWithAgent(worktreeId: string): void {
  launchRevioAgentChat(worktreeId, { prompt: 'Resolve branch incompatibility with remote' })
}

/**
 * "Pull latest" (⌘⇧L): on this Mac, fetch and fast-forward only; a diverged or dirty
 * branch goes to the agent to rebase or merge. SSH and cloud workspaces keep Orca's own rebase.
 */
export async function pullLatestWithRevio(
  worktreeId: string,
  baseRef: string,
  fallback: () => void
): Promise<void> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  const pull = window.api.git.pullLatestFromBase
  if (!worktree || !repo || getRepoExecutionHostId(repo) !== 'local' || !pull) {
    fallback()
    return
  }
  try {
    const outcome = await pull({ worktreePath: worktree.path, baseRef })
    if (outcome.kind === 'agent') {
      launchRevioAgentChat(worktreeId, { prompt: pullLatestAgentPrompt(outcome) })
      return
    }
    toast.success(
      outcome.kind === 'up-to-date'
        ? translate('auto.components.revioLayout.git.upToDate', 'Already up to date.')
        : translate(
            'auto.components.revioLayout.git.pulledLatest',
            "Pulled latest changes. You're up to date!"
          )
    )
    void state.refreshGitHubForWorktree(worktreeId)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}
