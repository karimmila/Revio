import { normalizeGitErrorMessage } from '../../shared/git/remotes/git-remote-error'
import { runWithGitWorktreeOperationLock } from '../../shared/git/worktrees/git-worktree-operation-lock'
import {
  REBASE_SOURCE_FETCH_TIMEOUT_MS,
  resolveGitRemoteRebaseSource
} from '../../shared/git/remotes/git-rebase-source'
import {
  nextContinueBranchName,
  type ContinueOnNewBranchResult
} from '../../shared/git/revio-continue-branch'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './source-control/git-read-cache-invalidation'

/**
 * "Continue" after a PR merges: the same worktree (and so the same chats) switches to
 * a new branch off the freshly fetched target. Uncommitted work comes along; git refuses the
 * switch if it would be overwritten.
 */
export async function gitContinueOnNewBranch(
  worktreePath: string,
  baseRef: string,
  options: GitRuntimeOptions = {}
): Promise<ContinueOnNewBranchResult> {
  return runWithGitWorktreeOperationLock(worktreePath, options.signal, () =>
    runWithGitReadCacheInvalidation(async () => {
      const run = { ...gitOptionsForWorktree(worktreePath, options), terminationBarrier: true }
      const git = (args: string[]) => gitExecFileAsync(args, run)
      try {
        const source = await resolveGitRemoteRebaseSource(git, baseRef)
        await gitExecFileAsync(
          [
            'fetch',
            source.remoteName,
            `+refs/heads/${source.branchName}:refs/remotes/${source.displayName}`
          ],
          { ...run, timeout: REBASE_SOURCE_FETCH_TIMEOUT_MS }
        ).catch(() => {
          // Offline: start from the last fetched copy of the target instead.
        })
        const current = (await git(['symbolic-ref', '--short', 'HEAD'])).stdout.trim()
        const heads = new Set(
          (await git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/'])).stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        )
        const branch = nextContinueBranchName(current, (name) => heads.has(name))
        if (!branch) {
          throw new Error(`No free branch name after ${current}.`)
        }
        await git(['switch', '--no-track', '-c', branch, `refs/remotes/${source.displayName}`])
        return { branch, base: source.displayName }
      } catch (error) {
        throw new Error(normalizeGitErrorMessage(error))
      }
    })
  )
}
