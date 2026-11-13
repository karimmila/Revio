import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { parseExecutionHostId } from '../../shared/execution-host'
import type { Repo } from '../../shared/repo-types'
import type { WorktreeSetupLaunch } from '../../shared/worktree/launch-types'
import { readRepoFile } from './cloud-repo-store'
import { CLOUD_SETUP_SCRIPT_PATH } from './vercel-workspace-provider'

/**
 * A new cloud workspace's setup runs in its "Setup" terminal tab, like a Mac workspace's, instead
 * of inside the create: the workspace opens as soon as the sandbox, SSH and checkout are ready.
 * The provider left the repository's cloud setup script at CLOUD_SETUP_SCRIPT_PATH.
 */
export function cloudSetupLaunchFor(
  repo: Pick<Repo, 'executionHostId'>,
  userDataPath: string
): WorktreeSetupLaunch | undefined {
  const host = parseExecutionHostId(repo.executionHostId)
  if (host?.kind !== 'runtime') {
    return undefined
  }
  const runtime = listEphemeralVmRuntimes(userDataPath).find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID && entry.runtimeEnvironmentId === host.environmentId
  )
  if (!runtime?.repoId || !readRepoFile(runtime.repoId).config.setupScript.trim()) {
    return undefined
  }
  return {
    runnerScriptPath: CLOUD_SETUP_SCRIPT_PATH,
    envVars: {},
    command: `bash ${CLOUD_SETUP_SCRIPT_PATH}`
  }
}
