import type { ExecutionHostId } from '../../shared/execution-host'
import type { GitHubRepositoryIdentity } from '../../shared/github/pull-request-types'
import type { RepoKind } from '../../shared/repo-types'
import { githubAvatarIcon, githubAvatarSlug, type RepoIcon } from '../../shared/repo-icon'
import { getRepoSlug, getRepoUpstream } from '../github/client/fetch/repo-slug-upstream'
import {
  resolveFilesystemRouteForHost,
  resolveGitRouteForHost
} from '../providers/execution-host-provider-dispatch'
import { detectGitRemoteIdentity } from '../workspaces/catalog/repo-git-remote-identity'
import { detectRepoFileIcon } from './repo-icon-file-detection'

// Runtime hosts must be refused: a null connection would read this machine's paths.
function repoRemoteReadConnection(
  executionHostId: ExecutionHostId
): { kind: 'refuse' } | { kind: 'dial'; connectionId: string | null } {
  const route = resolveGitRouteForHost(executionHostId)
  switch (route.kind) {
    case 'local':
      return { kind: 'dial', connectionId: null }
    case 'ssh':
      return { kind: 'dial', connectionId: route.connectionId }
    case 'runtime':
      return { kind: 'refuse' }
  }
}

export async function detectGitHubAvatarIcon(
  repoPath: string,
  executionHostId: ExecutionHostId,
  upstream?: GitHubRepositoryIdentity | null
): Promise<RepoIcon | null> {
  try {
    const target = repoRemoteReadConnection(executionHostId)
    if (target.kind === 'refuse') {
      return null
    }
    const slug = githubAvatarSlug(await getRepoSlug(repoPath, target.connectionId), upstream)
    return slug ? githubAvatarIcon(slug) : null
  } catch {
    return null
  }
}

export async function detectRepoIcon({
  repoPath,
  kind,
  executionHostId,
  upstream
}: {
  repoPath: string
  kind: RepoKind
  executionHostId: ExecutionHostId
  upstream?: GitHubRepositoryIdentity | null
}): Promise<RepoIcon | undefined> {
  try {
    const route = resolveFilesystemRouteForHost(executionHostId)
    const fileIcon = await detectRepoFileIcon(repoPath, route)
    if (fileIcon) {
      return fileIcon
    }

    // No icon from package.json's homepage: its favicon would come from a third-party service, which
    // would learn the project's site without the person choosing that. The icon picker still offers it.
    if (kind === 'git') {
      return (await detectGitHubAvatarIcon(repoPath, executionHostId, upstream)) ?? undefined
    }
  } catch {
    // Icon failures must not prevent repo creation.
  }
  return undefined
}

// A null upstream marks a resolved non-fork and prevents repeated probes.
export async function detectRepoIconAndUpstream({
  repoPath,
  kind,
  executionHostId
}: {
  repoPath: string
  kind: RepoKind
  executionHostId: ExecutionHostId
}) {
  const remoteRead = repoRemoteReadConnection(executionHostId)
  const upstream =
    kind === 'git' && remoteRead.kind === 'dial'
      ? await getRepoUpstream(repoPath, remoteRead.connectionId)
      : null
  const gitRemoteIdentity =
    kind === 'git'
      ? await detectGitRemoteIdentity(repoPath, executionHostId, {
          // Host Git on purpose: this runs while the project is being added, before it exists.
          hostGit: true
        })
      : null
  const repoIcon = await detectRepoIcon({ repoPath, kind, executionHostId, upstream })
  return {
    ...(repoIcon ? { repoIcon } : {}),
    ...(gitRemoteIdentity ? { gitRemoteIdentity } : {}),
    ...(kind === 'git' ? { upstream: upstream ?? null } : {})
  }
}
