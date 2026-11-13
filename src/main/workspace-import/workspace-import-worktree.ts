import type { BrowserWindow } from 'electron'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { Repo } from '../../shared/repo-types'
import type { CreateWorktreeArgs } from '../../shared/worktree/create-types'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'
import { composeWorktreeId } from '../../shared/worktree/id'
import { createLocalWorktree, notifyWorktreesChanged } from '../ipc/worktree-remote'
import { withProjectWorktreeCreate } from '../workspaces/creation/worktree-create-in-flight'
import { hostWorktreeTargetForRepo } from '../persistence/host-qualified-worktree-meta'
import {
  chooseBranchSource,
  type BranchSource,
  type WorkspaceImportGit
} from './workspace-import-project'
import { git } from './workspace-import-git'
import {
  applyMirrorChanges,
  fetchMirrorCommit,
  readMirrorChanges,
  type AppliedChanges
} from './workspace-import-mirror'

export type WorkspaceImportContext = {
  store: Store
  mainWindow: BrowserWindow
  runtime: OrcaRuntimeService
  git: WorkspaceImportGit
}

export type PlacedWorkspace = {
  worktreeId: string
  path: string
  /** How the branch was found: attached as is, reused, fetched, rebuilt from the mirror, or new. */
  branchSource: BranchSource | 'attached' | 'mirror'
  changes: AppliedChanges
}

export function worktreeNameSeed(source: ImportSourceWorkspace): string {
  const tail = source.branch?.split('/').pop() ?? source.name
  return tail.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imported'
}

/** Registers a worktree that already exists on disk, without touching its files. */
function attachExistingWorktree(
  ctx: WorkspaceImportContext,
  repo: Repo,
  source: ImportSourceWorkspace
): PlacedWorkspace {
  const merge = (paths: string[] | undefined): string[] => [
    ...new Set([...(paths ?? []), source.path])
  ]
  ctx.store.updateRepo(repo, {
    importedExternalWorktreePaths: merge(repo.importedExternalWorktreePaths),
    externalWorktreeInboxBaselinePaths: merge(repo.externalWorktreeInboxBaselinePaths)
  })
  const worktreeId = composeWorktreeId(repo.id, source.path)
  ctx.store.setWorktreeMeta(hostWorktreeTargetForRepo(worktreeId, repo), {
    displayName: source.name
  })
  notifyWorktreesChanged(ctx.mainWindow, repo.id)
  return { worktreeId, path: source.path, branchSource: 'attached', changes: 'none' }
}

async function freeBranchName(
  repoPath: string,
  wanted: string,
  g: WorkspaceImportGit
): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    const name = attempt === 1 ? `${wanted}-imported` : `${wanted}-imported-${attempt}`
    if (!(await g.hasLocalBranch(repoPath, name))) {
      return name
    }
  }
}

async function isAncestor(repoPath: string, commit: string, of: string): Promise<boolean> {
  try {
    await git(repoPath, ['merge-base', '--is-ancestor', commit, of])
    return true
  } catch {
    return false
  }
}

/**
 * A cloud workspace's mirror holds the exact commit and the uncommitted work. The branch is reused
 * when it already contains that commit; otherwise a branch is made at the commit, never moving one
 * the person already has.
 */
async function mirrorBranch(
  ctx: WorkspaceImportContext,
  repo: Repo,
  branch: string,
  head: string
): Promise<string> {
  if (await ctx.git.hasLocalBranch(repo.path, branch)) {
    if (await isAncestor(repo.path, head, `refs/heads/${branch}`)) {
      return branch
    }
  }
  const name = (await ctx.git.hasLocalBranch(repo.path, branch))
    ? await freeBranchName(repo.path, branch, ctx.git)
    : branch
  await git(repo.path, ['branch', name, head])
  return name
}

async function createWorktree(
  ctx: WorkspaceImportContext,
  repo: Repo,
  source: ImportSourceWorkspace,
  branch: { name: string; intent: CreateWorktreeArgs['branchIntent']; baseBranch?: string }
): Promise<{ worktreeId: string; path: string }> {
  const result = await withProjectWorktreeCreate(repo, () =>
    createLocalWorktree(
      {
        repoId: repo.id,
        name: worktreeNameSeed(source),
        displayName: source.name,
        displayNameKind: 'user',
        branchNameOverride: branch.name,
        branchIntent: branch.intent,
        ...(branch.baseBranch ? { baseBranch: branch.baseBranch } : {}),
        // A batch import must not start one setup run per workspace; each can run it later.
        setupDecision: 'skip'
      },
      repo,
      ctx.store,
      ctx.mainWindow,
      ctx.runtime
    )
  )
  return { worktreeId: result.worktree.id, path: result.worktree.path }
}

export async function placeImportedWorkspace(
  ctx: WorkspaceImportContext,
  repo: Repo,
  source: ImportSourceWorkspace,
  attach: boolean
): Promise<PlacedWorkspace> {
  if (attach) {
    return attachExistingWorktree(ctx, repo, source)
  }
  const branch = source.branch ?? worktreeNameSeed(source)
  if (source.mirrorPath) {
    const changes = await readMirrorChanges(source.mirrorPath)
    if (await fetchMirrorCommit(repo.path, source.mirrorPath, changes.head)) {
      const name = await mirrorBranch(ctx, repo, branch, changes.head)
      const made = await createWorktree(ctx, repo, source, { name, intent: 'open-existing-v2' })
      const applied = await applyMirrorChanges(made.path, source.mirrorPath, changes)
      return { ...made, branchSource: 'mirror', changes: applied }
    }
  }
  const found = await chooseBranchSource(repo.path, branch, ctx.git)
  const made = await createWorktree(ctx, repo, source, {
    name: branch,
    intent: found === 'new' ? 'create-new' : 'open-existing-v2',
    ...(found === 'remote' ? { baseBranch: `origin/${branch}` } : {})
  })
  return { ...made, branchSource: found, changes: 'none' }
}
