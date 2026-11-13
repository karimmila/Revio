import { useAppStore } from '@/store'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../shared/execution-host'
import type { Repo } from '../../../shared/repo-types'
import { cloudSourceRepoIdNow } from './cloud-workspaces'

type ForgeRepo = Pick<Repo, 'id' | 'path' | 'connectionId' | 'executionHostId'>

/**
 * The repository a GitHub call to this Mac's main process names. A cloud workspace's repository
 * is a checkout inside its sandbox, a path this Mac does not know ("Access denied: unknown
 * repository path"); the call names the local repository the sandbox was created from, which is
 * the same GitHub repository, as `cloudForgeLocalParams` does for runtime calls. Any other
 * repository names itself.
 */
export function forgeRepoTarget(
  repo: ForgeRepo,
  sourceRepoId: (environmentId: string) => string | null = cloudSourceRepoIdNow,
  repos: readonly Pick<Repo, 'id' | 'path'>[] = useAppStore.getState().repos
): { repoPath: string; repoId: string } {
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  const sourceId = host?.kind === 'runtime' ? sourceRepoId(host.environmentId) : null
  const source = sourceId ? repos.find((candidate) => candidate.id === sourceId) : undefined
  return source
    ? { repoPath: source.path, repoId: source.id }
    : { repoPath: repo.path, repoId: repo.id }
}
