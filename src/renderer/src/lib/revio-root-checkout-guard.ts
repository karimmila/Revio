import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { isRevioRootCheckout } from '../../../shared/revio-root-checkout'

type GuardState = Pick<
  AppState,
  'activeWorktreeId' | 'settings' | 'repos' | 'worktreesByRepo' | 'setActiveWorktree'
>

/** True when the open workspace is a repository's own checkout, which this layout never opens. */
export function activeWorktreeIsRevioRootCheckout(state: GuardState): boolean {
  const { activeWorktreeId } = state
  if (!activeWorktreeId || state.settings?.revioLayout !== true) {
    return false
  }
  const active = Object.values(selectWorktreesByRepo(state))
    .flat()
    .find((worktree) => worktree.id === activeWorktreeId)
  return isRevioRootCheckout(state.settings, state.repos, active)
}

/**
 * Activation already refuses a root checkout. This covers a selection that was set before the
 * facts were in: a session restored before its repository's worktrees were listed, or a profile
 * that changed to the workspace layout while a root checkout was open. It lands on Home.
 */
export function installRevioRootCheckoutGuard(store = useAppStore): () => void {
  const check = (state: GuardState): void => {
    if (activeWorktreeIsRevioRootCheckout(state)) {
      state.setActiveWorktree(null)
    }
  }
  check(store.getState())
  return store.subscribe((next, prev) => {
    if (
      next.activeWorktreeId !== prev.activeWorktreeId ||
      next.settings?.revioLayout !== prev.settings?.revioLayout ||
      next.repos !== prev.repos ||
      selectWorktreesByRepo(next) !== selectWorktreesByRepo(prev)
    ) {
      check(next)
    }
  })
}
