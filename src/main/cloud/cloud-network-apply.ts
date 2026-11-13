import { app } from 'electron'
import { Sandbox } from '@vercel/sandbox'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { readCloudClaudeToken } from './cloud-claude-token'
import { githubRepoOf, sandboxNetworkPolicy } from './cloud-github'
import { githubTokenForRepo } from './cloud-github-access'
import { readRepoFile } from './cloud-repo-store'
import { networkOf } from './vercel-workspace-io'

function runningCloudRuntimes(): ReturnType<typeof listEphemeralVmRuntimes> {
  return listEphemeralVmRuntimes(app.getPath('userData')).filter(
    (runtime) => runtime.recipeId === VERCEL_CLOUD_RECIPE_ID && runtime.status === 'running'
  )
}

/** Repositories with at least one running cloud workspace. */
export function repoIdsWithRunningWorkspaces(): string[] {
  return [
    ...new Set(
      runningCloudRuntimes()
        .map((runtime) => runtime.repoId)
        .filter((id): id is string => typeof id === 'string')
    )
  ]
}

/**
 * A repository's new Network choice, or a rotated GitHub token, reaches its running cloud
 * workspaces at once (Vercel swaps the firewall rules in place); stopped ones pick it up when
 * they resume.
 */
export async function applyNetworkToRunningWorkspaces(
  repoId: string,
  repoPath: string
): Promise<number> {
  const running = runningCloudRuntimes().filter((runtime) => runtime.repoId === repoId)
  const repo = await githubRepoOf(repoPath)
  if (running.length === 0 || !repo) {
    return 0
  }
  const { config } = readRepoFile(repoId)
  // Without a usable token GitHub is closed (403) rather than the network change failing.
  const github = await githubTokenForRepo(repo).catch(() => null)
  const policy = sandboxNetworkPolicy(repo, github, readCloudClaudeToken(), networkOf(config))
  const scope = await vercelScope()
  let applied = 0
  for (const runtime of running) {
    const userData = runtime.recipeResult?.userData
    const name = userData && typeof userData === 'object' ? userData.sandboxName : undefined
    if (typeof name !== 'string') {
      continue
    }
    try {
      await (await Sandbox.get({ ...scope, name })).updateNetworkPolicy(policy)
      applied += 1
    } catch {
      // A sandbox Vercel stopped meanwhile gets the rules on resume.
    }
  }
  return applied
}
