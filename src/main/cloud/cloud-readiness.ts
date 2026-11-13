import type { CloudBuild, CloudRepoReadiness } from '../../shared/cloud/cloud-types'
import { currentSnapshot } from '../../shared/cloud/cloud-types'
import type { Repo } from '../../shared/repo-types'
import { readVercelStatus } from '../vercel-cloud/vercel-cloud-auth'
import { isCloudBuildRunning } from './cloud-build'
import { CLOUD_BUILD_EXPIRED } from './cloud-build-check'
import { githubRepoOf } from './cloud-github'
import { githubCoverageProblem } from './cloud-github-access'
import { isGithubOwner } from './cloud-github-status'
import { readRepoFile } from './cloud-repo-store'

export function missingBuildReason(builds: readonly CloudBuild[], slug: string): string {
  if (builds[0]?.state === 'failed') {
    return `The cloud build of ${slug} failed. Fix it and build again in its Cloud settings.`
  }
  if (builds.find((entry) => entry.state === 'succeeded')?.error === CLOUD_BUILD_EXPIRED) {
    return `Vercel no longer has the cloud build of ${slug}. Rebuild it to create cloud workspaces.`
  }
  return `Build ${slug} for the cloud first, in its Cloud settings.`
}

/**
 * For each of this Mac's Git repositories with a GitHub origin: can Create make a cloud workspace
 * from it right now, and if not, the one step that fixes it. Checked in the order a person would
 * fix them: Vercel, then GitHub, then the build.
 */
export async function readCloudReadiness(repos: readonly Repo[]): Promise<CloudRepoReadiness[]> {
  const vercel = await readVercelStatus().catch(() => null)
  const vercelConnected = vercel?.state === 'connected'
  const result: CloudRepoReadiness[] = []
  for (const repo of repos) {
    if (repo.kind === 'folder') {
      continue
    }
    const github = await githubRepoOf(repo.path)
    if (!github || !isGithubOwner(github.owner)) {
      continue
    }
    const slug = `${github.owner}/${github.name}`
    const builds = readRepoFile(repo.id).builds
    const build = currentSnapshot({ builds })
    const building = isCloudBuildRunning(repo.id)
    const githubProblem = await githubCoverageProblem(github)
    const blocked: CloudRepoReadiness['blocked'] = !vercelConnected
      ? {
          reason: 'Connect Vercel in Settings > Cloud to create cloud workspaces.',
          action: 'connect-vercel'
        }
      : githubProblem
        ? { reason: githubProblem, action: 'connect-github' }
        : building && !build
          ? { reason: `${slug} is still building for the cloud.`, action: 'build' }
          : !build
            ? { reason: missingBuildReason(builds, slug), action: 'build' }
            : null
    result.push({
      repoId: repo.id,
      owner: github.owner,
      name: github.name,
      builtAt: build?.finishedAt ?? null,
      building,
      blocked
    })
  }
  return result
}
