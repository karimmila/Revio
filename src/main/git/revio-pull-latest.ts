import { randomUUID } from 'node:crypto'
import { normalizeGitErrorMessage } from '../../shared/git/remotes/git-remote-error'
import { isNoWriteFetchHeadUnsupportedError } from '../../shared/git/fetch/git-fetch-head-capability'
import { runWithGitWorktreeOperationLock } from '../../shared/git/worktrees/git-worktree-operation-lock'
import {
  REBASE_SOURCE_FETCH_TIMEOUT_MS,
  resolveGitRemoteRebaseSource
} from '../../shared/git/remotes/git-rebase-source'
import {
  decidePullLatest,
  pullRebaseEnabled,
  type PullLatestOutcome
} from '../../shared/git/revio-pull-latest'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { withLocalGitCapabilityCacheForExecution } from './command-runner/git-capability-state'
import { gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './source-control/git-read-cache-invalidation'

/**
 * "Pull latest from <target>": fetch the target, then fast-forward when the branch is
 * only behind. A diverged or dirty branch is left alone and reported, so the agent can rebase or
 * merge it (by `pull.rebase`) and resolve any conflicts; the app never starts a conflicting step.
 */
export async function gitPullLatestFromBase(
  worktreePath: string,
  baseRef: string,
  options: GitRuntimeOptions = {}
): Promise<PullLatestOutcome> {
  return runWithGitWorktreeOperationLock(worktreePath, options.signal, () =>
    runWithGitReadCacheInvalidation(async () => {
      const run = { ...gitOptionsForWorktree(worktreePath, options), terminationBarrier: true }
      const git = (args: string[]) => gitExecFileAsync(args, run)
      let fetchedRef: string | null = null
      try {
        const source = await resolveGitRemoteRebaseSource(git, baseRef)
        // A private ref keeps a concurrent fetch from moving the target between fetch and merge.
        fetchedRef = `refs/orca/pull-latest/${randomUUID()}`
        const fetchArgs = [
          '--prune',
          source.remoteName,
          `+refs/heads/${source.branchName}:${fetchedRef}`,
          `+refs/heads/${source.branchName}:refs/remotes/${source.displayName}`
        ]
        await withLocalGitCapabilityCacheForExecution({ cwd: worktreePath, ...options }, (caps) =>
          caps.runWithFallback(
            'fetch-no-write-fetch-head',
            () =>
              gitExecFileAsync(['fetch', '--no-write-fetch-head', ...fetchArgs], {
                ...run,
                timeout: REBASE_SOURCE_FETCH_TIMEOUT_MS
              }),
            () =>
              gitExecFileAsync(['fetch', ...fetchArgs], {
                ...run,
                timeout: REBASE_SOURCE_FETCH_TIMEOUT_MS
              }),
            isNoWriteFetchHeadUnsupportedError
          )
        )
        const counts = (
          await git(['rev-list', '--left-right', '--count', `HEAD...${fetchedRef}`])
        ).stdout.trim()
        const [ahead = 0, behind = 0] = counts.split(/\s+/).map(Number)
        const dirty = (await git(['status', '--porcelain'])).stdout.trim() !== ''
        const pullRebase = await git(['config', '--get', 'pull.rebase']).then(
          (result) => pullRebaseEnabled(result.stdout),
          () => false
        )
        const base = source.displayName
        const kind = decidePullLatest({ base, ahead, behind, dirty, pullRebase })
        if (kind === 'up-to-date') {
          return { kind, base }
        }
        if (kind === 'fast-forwarded') {
          await git(['merge', '--ff-only', fetchedRef])
          return { kind, base }
        }
        return { kind: 'agent', base, reason: kind, rebase: pullRebase }
      } catch (error) {
        throw new Error(normalizeGitErrorMessage(error, 'pull'))
      } finally {
        if (fetchedRef) {
          const { signal: _signal, ...cleanup } = gitOptionsForWorktree(worktreePath, options)
          await gitExecFileAsync(['update-ref', '-d', fetchedRef], cleanup).catch(() => {})
        }
      }
    })
  )
}
