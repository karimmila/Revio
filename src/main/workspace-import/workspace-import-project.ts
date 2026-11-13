import { resolve } from 'node:path'
import type { Repo } from '../../shared/repo-types'
import { normalizeGitRemoteUrl } from '../../shared/git/remotes/git-remote-identity'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'

/** Git questions the import asks, injected so the decisions can be tested without repositories. */
export type WorkspaceImportGit = {
  /** Absolute common git dir of a checkout, or null when the folder is not a git checkout. */
  commonDir: (path: string) => Promise<string | null>
  hasLocalBranch: (repoPath: string, branch: string) => Promise<boolean>
  /** Fetches `origin/<branch>` when the remote has it; false when it does not. */
  fetchRemoteBranch: (repoPath: string, branch: string) => Promise<boolean>
}

export type ProjectChoice =
  | { kind: 'existing'; repo: Repo; attachWorktree: boolean }
  | { kind: 'add'; path: string; attachWorktree: boolean }
  | { kind: 'none' }

function sameRemote(repo: Repo, remoteUrl: string | null): boolean {
  const wanted = remoteUrl ? normalizeGitRemoteUrl(remoteUrl) : null
  const have = repo.gitRemoteIdentity?.remoteUrl
    ? normalizeGitRemoteUrl(repo.gitRemoteIdentity.remoteUrl)
    : null
  return wanted !== null && wanted === have
}

/**
 * A worktree belongs to exactly one clone, so an existing worktree folder only attaches to a project
 * that shares its git dir. With no folder left, any project on the same remote can host a new one.
 */
export async function chooseImportProject(
  source: ImportSourceWorkspace,
  repos: readonly Repo[],
  git: WorkspaceImportGit
): Promise<ProjectChoice> {
  const worktreeCommonDir = await git.commonDir(source.path)
  const candidates = repos.filter(
    (repo) => repo.kind !== 'folder' && sameRemote(repo, source.repoRemoteUrl)
  )
  if (worktreeCommonDir) {
    for (const repo of candidates) {
      if ((await git.commonDir(repo.path)) === worktreeCommonDir) {
        return { kind: 'existing', repo, attachWorktree: true }
      }
    }
    // The worktree's own main checkout is the clone it belongs to.
    return { kind: 'add', path: resolve(worktreeCommonDir, '..'), attachWorktree: true }
  }
  const sourceClone = source.repoRootPath
  if (sourceClone) {
    const sourceCommonDir = await git.commonDir(sourceClone)
    for (const repo of candidates) {
      if (sourceCommonDir && (await git.commonDir(repo.path)) === sourceCommonDir) {
        return { kind: 'existing', repo, attachWorktree: false }
      }
    }
  }
  if (candidates[0]) {
    return { kind: 'existing', repo: candidates[0], attachWorktree: false }
  }
  return sourceClone && (await git.commonDir(sourceClone))
    ? { kind: 'add', path: sourceClone, attachWorktree: false }
    : { kind: 'none' }
}

export type BranchSource = 'local' | 'remote' | 'new'

/** Reuse the branch where it still exists; only a branch gone everywhere starts fresh from base. */
export async function chooseBranchSource(
  repoPath: string,
  branch: string,
  git: WorkspaceImportGit
): Promise<BranchSource> {
  if (await git.hasLocalBranch(repoPath, branch)) {
    return 'local'
  }
  return (await git.fetchRemoteBranch(repoPath, branch)) ? 'remote' : 'new'
}
