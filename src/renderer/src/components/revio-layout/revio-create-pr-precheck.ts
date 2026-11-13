import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { githubSlugOfRepo } from '@/lib/cloud-create-guard'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { refreshClaudeLoginRoute } from '@/lib/claude-login-route-store'
import { getConnectionId } from '@/lib/connection-context'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { getRuntimeGitBranchCompare } from '@/runtime/runtime-git-diff-client'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { ClaudeLoginRoute } from '../../../../shared/claude-login-route'
import type { CloudGithubStatus } from '../../../../shared/cloud/cloud-types'
import type { GithubRepoRef } from '../../../../shared/cloud/github-remote'
import type { GitBranchCompareSummary } from '../../../../shared/git/diff/git-diff-compare-types'

/** What stops a pull request before any chat starts; each names the one step that clears it. */
export type CreatePrBlock =
  | { kind: 'claude-sign-in' }
  | { kind: 'no-remote'; repoId: string }
  | { kind: 'github-sign-in'; expired: boolean }
  | { kind: 'install-app'; owner: string }
  | { kind: 'no-changes' }

export type CreatePrFacts = {
  repoId: string
  /** The agent writes the PR; false for GitHub's own compare page. */
  usesAgent: boolean
  /** A chat on this Mac with Claude, the one case the Mac's Claude login decides. */
  localClaudeChat: boolean
  claudeRoute: ClaudeLoginRoute | null
  /** Null when the status could not be read: then GitHub is not what blocks. */
  github: CloudGithubStatus | null
  /** Whether the repository has a remote on the app's GitHub host; null while not known. */
  remoteOnAppHost: boolean | null
  /** Owner and name on github.com, for the app's coverage of this repository. */
  slug: GithubRepoRef | null
  /** Null when git could not be asked: then the worktree is not known to be clean. */
  uncommitted: number | null
  compare: Pick<GitBranchCompareSummary, 'status' | 'changedFiles' | 'commitsAhead'> | null
}

/**
 * The first thing that would make "Create PR" fail. Unknown facts never block: a status that
 * could not be read, or a branch comparison still loading, lets the request through.
 */
export function createPrBlock(facts: CreatePrFacts): CreatePrBlock | null {
  if (facts.usesAgent && facts.localClaudeChat && facts.claudeRoute === 'none') {
    return { kind: 'claude-sign-in' }
  }
  if (facts.remoteOnAppHost === false) {
    return { kind: 'no-remote', repoId: facts.repoId }
  }
  const github = facts.github
  // GitHub's own compare page needs no app token; the agent's `gh` and push do.
  if (facts.usesAgent && github?.app.configured) {
    if (!github.account) {
      return { kind: 'github-sign-in', expired: github.signInExpired }
    }
    const slug = facts.slug
    const coverage = github.repos.find(
      (repo) =>
        repo.repoId === facts.repoId ||
        (slug !== null &&
          repo.owner.toLowerCase() === slug.owner.toLowerCase() &&
          repo.name.toLowerCase() === slug.name.toLowerCase())
    )
    if (coverage?.state === 'not-covered') {
      return { kind: 'install-app', owner: coverage.owner }
    }
  }
  return branchHasNoChanges(facts.uncommitted, facts.compare) ? { kind: 'no-changes' } : null
}

/**
 * A clean worktree on a branch level with its base: nothing to review or to open a pull request
 * for. False while either fact is unknown (not read yet, loading or failed), so a guess never
 * refuses work.
 */
export function branchHasNoChanges(
  uncommitted: number | null,
  compare: CreatePrFacts['compare'] | undefined
): boolean {
  return (
    uncommitted === 0 &&
    compare?.status === 'ready' &&
    compare.changedFiles === 0 &&
    (compare.commitsAhead ?? 0) === 0
  )
}

export function createPrBlockMessage(block: CreatePrBlock): string {
  switch (block.kind) {
    case 'claude-sign-in':
      return translate(
        'auto.components.revioLayout.createPrBlock.claudeSignIn',
        'Sign in to Claude to create a pull request.'
      )
    case 'no-remote':
      return translate(
        'auto.components.revioLayout.createPrBlock.noRemote',
        'Add a GitHub remote to open pull requests.'
      )
    case 'github-sign-in':
      return block.expired
        ? translate(
            'auto.components.revioLayout.createPrBlock.githubExpired',
            'Your GitHub sign-in expired. Sign in again to open pull requests.'
          )
        : translate(
            'auto.components.revioLayout.createPrBlock.githubSignIn',
            'Sign in with GitHub to open pull requests.'
          )
    case 'install-app':
      return translate(
        'auto.components.revioLayout.createPrBlock.installApp',
        'The {{productName}} GitHub App is not installed on {{owner}}, so it cannot open a pull request there.',
        { owner: block.owner }
      )
    case 'no-changes':
      return translate(
        'auto.components.revioLayout.createPrBlock.noChanges',
        'No changes to open a pull request for.'
      )
  }
}

type GitContext = {
  target: NonNullable<ReturnType<typeof runtimeTargetForWorkspaceOwner>>
  worktreeId: string
  worktreePath: string
  connectionId?: string
  baseRef: string | undefined
}

function gitContextFor(worktreeId: string): GitContext | null {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const target = worktree
    ? runtimeTargetForWorkspaceOwner(state, { workspaceId: worktreeId })
    : null
  if (!worktree || !target) {
    return null
  }
  return {
    target,
    worktreeId,
    worktreePath: worktree.path,
    connectionId: getConnectionId(worktreeId) ?? undefined,
    baseRef: state.gitBranchCompareSummaryByWorktree?.[worktreeId]?.baseRef ?? worktree.baseRef
  }
}

/**
 * How many files git reports as changed in the worktree, asked now. The store only holds what a
 * panel last loaded: right after an agent wrote a file it is empty or stale, and an empty list
 * there says nothing. Null when git cannot be asked or does not answer.
 */
export async function readUncommittedCount(worktreeId: string): Promise<number | null> {
  const context = gitContextFor(worktreeId)
  if (!context) {
    return null
  }
  try {
    const status = await getRuntimeGitStatus(context, {
      admissionTier: 'interactive',
      includeLineStats: false
    })
    return status.entries.length
  } catch {
    return null
  }
}

/**
 * The branch against its base, asked now for the same reason: a comparison the Changes tab loaded
 * earlier does not know the commits made since. Null when it stays unknown (no base, or git
 * failed): callers then let the action through.
 */
export async function readBranchCompare(worktreeId: string): Promise<CreatePrFacts['compare']> {
  const context = gitContextFor(worktreeId)
  if (!context?.baseRef) {
    return null
  }
  try {
    return (await getRuntimeGitBranchCompare(context, context.baseRef)).summary
  } catch {
    return null
  }
}

/** True only when git, asked now, reports a clean worktree on a branch level with its base. */
export async function workspaceHasNoChanges(worktreeId: string): Promise<boolean> {
  const uncommitted = await readUncommittedCount(worktreeId)
  // Only a clean worktree can have nothing to open a pull request for.
  return uncommitted === 0 && branchHasNoChanges(0, await readBranchCompare(worktreeId))
}

/**
 * `undefined` identity: not probed yet. `null`: probed, and the repository has no remote. A remote
 * that is neither github.com nor the configured GitHub Enterprise host counts as none here.
 */
export function remoteOnAppHost(
  identity: { remoteUrl: string } | null | undefined,
  slug: GithubRepoRef | null,
  github: CloudGithubStatus | null
): boolean | null {
  if (identity === undefined) {
    return null
  }
  if (identity === null) {
    return false
  }
  if (slug) {
    return true
  }
  const host = github?.app.configured ? github.app.host.toLowerCase() : 'github.com'
  return host !== 'github.com' && identity.remoteUrl.toLowerCase().includes(host)
}

/** Reads the facts for a workspace now; null when the workspace or its repository is gone. */
export async function readCreatePrBlock(
  worktreeId: string,
  usesAgent: boolean
): Promise<CreatePrBlock | null> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!repo || !isGitRepoKind(repo)) {
    return null
  }
  const cloud = isCloudRepo(repo, cloudEnvironmentIdsNow())
  const agent = state.settings?.defaultTuiAgent
  const localClaudeChat = !cloud && (!agent || agent === 'blank' || agent === 'claude')
  const [claudeRoute, github, uncommitted] = await Promise.all([
    usesAgent && localClaudeChat ? refreshClaudeLoginRoute() : Promise.resolve(null),
    (window.api.cloud?.githubStatus() ?? Promise.resolve(null)).catch(() => null),
    readUncommittedCount(worktreeId)
  ])
  // Only a clean worktree can have nothing to open a pull request for.
  const compare = uncommitted === 0 ? await readBranchCompare(worktreeId) : null
  const slug = githubSlugOfRepo(repo)
  return createPrBlock({
    repoId: repo.id,
    usesAgent,
    localClaudeChat,
    claudeRoute,
    github,
    remoteOnAppHost: remoteOnAppHost(repo.gitRemoteIdentity, slug, github),
    slug,
    uncommitted,
    compare
  })
}
