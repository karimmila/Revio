import { withGitHubRepoExecution } from '../../github-repository-identity'
import { ghExecFileAsync, acquire, release, type LocalGitExecOptions } from '../../gh-utils'
import { resolveGitHubRepoExecution, type GitHubApiRepository } from '../../github-api-repository'
import type { PRDeployment } from '../../../../shared/github/deployment-types'

const MAX_DEPLOYMENTS = 10

type RawDeployment = { id?: unknown; environment?: unknown; created_at?: unknown }
type RawStatus = { state?: unknown; environment_url?: unknown; log_url?: unknown }

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** The newest deployment per environment; GitHub lists newest first. */
export function latestPerEnvironment(raw: readonly RawDeployment[]): RawDeployment[] {
  const seen = new Set<string>()
  return raw.filter((deployment) => {
    const environment = text(deployment.environment)
    if (!environment || typeof deployment.id !== 'number' || seen.has(environment)) {
      return false
    }
    seen.add(environment)
    return true
  })
}

export function toPRDeployment(
  deployment: RawDeployment,
  status: RawStatus | undefined
): PRDeployment {
  return {
    id: typeof deployment.id === 'number' ? deployment.id : 0,
    environment: text(deployment.environment) ?? '',
    state: text(status?.state) ?? 'pending',
    url: text(status?.environment_url) ?? text(status?.log_url),
    createdAt: text(deployment.created_at) ?? ''
  }
}

/** Read-only: the deployments GitHub records for a commit, each with its latest status. */
export async function getPRDeployments(
  repoPath: string,
  headSha: string,
  prRepo: GitHubApiRepository | null,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<PRDeployment[]> {
  if (!/^[0-9a-f]{7,64}$/i.test(headSha)) {
    return []
  }
  return withGitHubRepoExecution(repoPath, connectionId, localGitOptions, async () => {
    const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
      repoPath,
      prRepo,
      connectionId,
      localGitOptions
    )
    if (!ownerRepo) {
      return []
    }
    const base = `repos/${ownerRepo.owner}/${ownerRepo.repo}/deployments`
    const env = { ...process.env, GH_PROMPT_DISABLED: '1' }
    await acquire()
    try {
      const { stdout } = await ghExecFileAsync(['api', `${base}?sha=${headSha}&per_page=30`], {
        ...ghOptions,
        env
      })
      const parsed: unknown = JSON.parse(stdout)
      const deployments = latestPerEnvironment(Array.isArray(parsed) ? parsed : []).slice(
        0,
        MAX_DEPLOYMENTS
      )
      return await Promise.all(
        deployments.map(async (deployment) => {
          const statuses = await ghExecFileAsync(
            ['api', `${base}/${String(deployment.id)}/statuses?per_page=1`],
            { ...ghOptions, env }
          )
            .then(({ stdout: out }): unknown => JSON.parse(out))
            .catch(() => [])
          return toPRDeployment(deployment, Array.isArray(statuses) ? statuses[0] : undefined)
        })
      )
    } catch {
      return []
    } finally {
      release()
    }
  })
}
