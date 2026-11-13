import type { GitPushTarget } from '../../shared/worktree/types'
import { gitExecFileAsync } from './runner'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'

type PinnedRemoteLookup = (key: { repoId?: string; repoPath?: string }) => string | null

let lookup: PinnedRemoteLookup = () => null

/**
 * Settings, repository, "Remote": a remote that push, pull/fetch and PR lookup use for this
 * repository. Unset ("Automatic") keeps Orca's fork-aware choice per action.
 */
export function setPinnedRemoteLookup(next: PinnedRemoteLookup): void {
  lookup = next
}

export function pinnedRemoteFor(key: { repoId?: string; repoPath?: string }): string | null {
  return lookup(key)
}

/** The repo id inside a worktree id (`<repoId>::<path>`). */
export function repoIdOfWorktreeId(worktreeId: string | undefined): string | undefined {
  const index = worktreeId?.indexOf('::') ?? -1
  return worktreeId && index > 0 ? worktreeId.slice(0, index) : undefined
}

/**
 * A push/pull/fetch target on the pinned remote, for the branch checked out in the worktree, when
 * the caller named none. Detached HEAD or no pin keeps Orca's own resolution (undefined).
 */
export async function pinnedRemotePushTarget(
  worktreePath: string,
  key: { repoId?: string; repoPath?: string },
  options: GitRuntimeOptions = {}
): Promise<GitPushTarget | undefined> {
  const remoteName = pinnedRemoteFor(key)
  if (!remoteName) {
    return undefined
  }
  const { stdout } = await gitExecFileAsync(
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    gitOptionsForWorktree(worktreePath, options)
  ).catch(() => ({ stdout: '' }))
  const branchName = stdout.trim()
  return branchName ? { remoteName, branchName } : undefined
}

/** The repository's remote names (`git remote`), for the Remote picker. */
export async function listGitRemotes(repoPath: string): Promise<string[]> {
  const { stdout } = await gitExecFileAsync(['remote'], { cwd: repoPath }).catch(() => ({
    stdout: ''
  }))
  return stdout
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
}
