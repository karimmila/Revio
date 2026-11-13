import { discardRepoPreparations, listPreparations } from './worktree-create-preparation-pool'
import { settlePreparationDiscards } from './worktree-preparation-discard-retry'

/**
 * At quit no create is left to claim the checkouts prepared ahead of time, so each is discarded:
 * its folder under the workspace folder and its locked entry in the project's worktree list.
 * The caller bounds the wait; what does not finish is reclaimed at the next launch.
 */
export function discardWorktreeCreatePreparationsOnQuit(): Promise<void> {
  for (const repoPathKey of new Set(listPreparations().map((entry) => entry.repoPathKey))) {
    discardRepoPreparations(repoPathKey)
  }
  return settlePreparationDiscards()
}
