import { worktreePreparationGit } from '../../../git/worktrees/creation/worktree-create-git-executor'
import type { AddWorktreeOptions } from '../../../git/worktrees/worktree-operation-options'
import type { Repo } from '../../../../shared/repo-types'
import { isFolderRepo } from '../../../../shared/repo-kind'
import { getRepoRoutingConnectionId } from '../../../../shared/execution-host'
import { getLocalProjectWorktreeGitOptions } from '../../execution-host/project-runtime-git-options'
import type { ProjectRuntimeResolutionStore } from '../../execution-host/local-project-runtime-resolution'
import { discardRepoPreparations } from './worktree-create-preparation-pool'
import { preparationPathKey } from './worktree-create-preparation-claim'
import { preparationHostKey } from './worktree-preparation-discard-retry'
import { startStalePreparationCleanup } from './worktree-create-preparation-stale-cleanup'
import { blockedWslDistroForPath } from '../../../wsl/filesystem/wsl-unc-access-gate'

/** Removal is the last point Orca knows this repo, so reclaim its armed and crash-left checkouts now. */
export function releaseWorktreeCreatePreparationsForRepo(
  store: ProjectRuntimeResolutionStore,
  repo: Repo
): void {
  if (getRepoRoutingConnectionId(repo) || isFolderRepo(repo)) {
    return
  }
  const repoPathKey = preparationPathKey(repo.path)
  discardRepoPreparations(repoPathKey)
  let options: AddWorktreeOptions
  try {
    options = getLocalProjectWorktreeGitOptions(store, repo)
  } catch {
    // A runtime needing repair cannot run Git, and must not block forgetting its project.
    return
  }
  reclaimCrashLeftPreparations(repo, repoPathKey, options)
}

function reclaimCrashLeftPreparations(
  repo: Repo,
  repoPathKey: string,
  options: AddWorktreeOptions
): void {
  void worktreePreparationGit.run(async () => {
    // Background reclaim must not boot a stopped WSL distro (E9).
    if (await blockedWslDistroForPath(repo.path, options.wslDistro)) {
      return
    }
    await startStalePreparationCleanup(
      preparationHostKey(repoPathKey, options.wslDistro ?? ''),
      repo.path,
      options
    )
  })
}

/**
 * At launch: a quit that was killed, or a crash, leaves a prepared checkout in the workspace
 * folder and its locked entry in the project's worktree list until the next create for that
 * project. This reclaims them for every local project, and only the entries whose lock names a
 * process of this Mac that is gone.
 */
export function reclaimStaleWorktreeCreatePreparations(
  store: ProjectRuntimeResolutionStore,
  repos: readonly Repo[]
): void {
  for (const repo of repos) {
    if (getRepoRoutingConnectionId(repo) || isFolderRepo(repo)) {
      continue
    }
    try {
      reclaimCrashLeftPreparations(
        repo,
        preparationPathKey(repo.path),
        getLocalProjectWorktreeGitOptions(store, repo)
      )
    } catch {
      // A runtime needing repair cannot run Git; its leftovers wait for the next create.
    }
  }
}
