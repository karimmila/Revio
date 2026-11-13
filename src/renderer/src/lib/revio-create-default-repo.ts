import { normalizeRuntimePathForComparison } from '../../../shared/cross-platform-path'
import { isGitRepoKind } from '../../../shared/repo-kind'
import type { Repo } from '../../../shared/repo-types'
import {
  resolveWorkspaceCreationTarget,
  type WorkspaceCreationTargetResolution
} from './project-host-workspace-target'

type HomeFolderFacts = Pick<Repo, 'kind' | 'path' | 'displayName'>

// A user home on macOS, Linux or Windows, as normalizeRuntimePathForComparison spells it. The
// renderer has no synchronous home directory, and the seeded "~" project always sits at one.
const HOME_DIRECTORY_PATH =
  /^(?:\/users\/[^/]+|\/home\/[^/]+|\/root|\/var\/root|[a-z]:\/users\/[^/]+)$/i

/**
 * The home-folder project: a folder project at the user's home directory (Orca seeds one named
 * "~" on first run). A workspace there runs its agent over the whole home folder.
 */
export function isHomeFolderProject(repo: HomeFolderFacts): boolean {
  if (isGitRepoKind(repo)) {
    return false
  }
  const path = normalizeRuntimePathForComparison(repo.path)
  return path === '~' || HOME_DIRECTORY_PATH.test(path) || repo.displayName.trim() === '~'
}

const LAST_CREATE_REPO_KEY = 'orca.revio.lastCreateRepoId'

/** The real project the last workspace was created in; a per-Mac convenience only. */
export function lastCreateRepoId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CREATE_REPO_KEY)
  } catch {
    return null
  }
}

export function rememberCreateRepo(repo: HomeFolderFacts & Pick<Repo, 'id'>): void {
  homeFolderPickRepoId = null
  if (isHomeFolderProject(repo)) {
    return
  }
  try {
    window.localStorage.setItem(LAST_CREATE_REPO_KEY, repo.id)
  } catch {
    // Storage can be unavailable; Create then defaults to the first real project.
  }
}

// The home-folder project the person chose in the project picker, if any. Session memory, like
// the draft it guards: only that choice may keep "~" selected when the card reopens.
let homeFolderPickRepoId: string | null = null

export function notePickedProject(repo: HomeFolderFacts & Pick<Repo, 'id'>): void {
  homeFolderPickRepoId = isHomeFolderProject(repo) ? repo.id : null
}

export function pickedHomeFolderRepoId(): string | null {
  return homeFolderPickRepoId
}

type ResolveInput = Parameters<typeof resolveWorkspaceCreationTarget>[0]

/**
 * Workspace layout: Create never defaults to the home-folder project. A seed that lands on it
 * (the active workspace, a draft, an initial repo) moves to the last real project a workspace was
 * created in, else the first real eligible one. "~" stays when the person picked it, or when no
 * other project can take the workspace.
 */
export function avoidHomeFolderDefault({
  resolution,
  input,
  lastCreatedRepoId,
  explicitHomeRepoId
}: {
  resolution: WorkspaceCreationTargetResolution
  input: ResolveInput
  lastCreatedRepoId: string | null
  explicitHomeRepoId: string | null
}): WorkspaceCreationTargetResolution {
  if (resolution.status !== 'ready' || !isHomeFolderProject(resolution.target.repo)) {
    return resolution
  }
  if (explicitHomeRepoId && resolution.target.repoId === explicitHomeRepoId) {
    return resolution
  }
  const realRepoIds = input.eligibleRepos
    .filter((repo) => !isHomeFolderProject(repo))
    .map((repo) => repo.id)
  const candidates = [
    ...(lastCreatedRepoId && realRepoIds.includes(lastCreatedRepoId) ? [lastCreatedRepoId] : []),
    ...realRepoIds
  ]
  for (const repoId of new Set(candidates)) {
    const replacement = resolveWorkspaceCreationTarget({
      eligibleRepos: input.eligibleRepos,
      projects: input.projects,
      projectHostSetups: input.projectHostSetups,
      activeRepoId: repoId,
      focusedHostScope: input.focusedHostScope,
      actionableHostIds: input.actionableHostIds
    })
    if (
      replacement.status === 'ready' &&
      replacement.target.repoId === repoId &&
      !isHomeFolderProject(replacement.target.repo)
    ) {
      return replacement
    }
  }
  return resolution
}
