import { ipcMain } from 'electron'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'
import { getPRDeployments } from '../../github/client/check/get-pr-deployments'
import type { Store } from '../../persistence/loading-store/store'
import {
  assertRegisteredGitHubRepo,
  getGitHubLocalGitOptionArgs,
  getGitHubRepoConnectionId,
  type GitHubRepoScopedArgs
} from './github-repo-routing'

/** Read-only: deployments of a pull request's head commit for the Checks tab. */
export function registerGitHubPRDeploymentHandlers(store: Store): void {
  ipcMain.handle(
    'gh:prDeployments',
    async (
      _event,
      args: GitHubRepoScopedArgs & { headSha: string; prRepo?: GitHubOwnerRepo | null }
    ) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      if (typeof args.headSha !== 'string') {
        return []
      }
      return getPRDeployments(
        repo.path,
        args.headSha,
        args.prRepo ?? null,
        getGitHubRepoConnectionId(repo),
        ...getGitHubLocalGitOptionArgs(store, repo)
      )
    }
  )
}
