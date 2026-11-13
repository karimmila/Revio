import { ipcMain } from 'electron'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'
import { approvePR } from '../../github/client/update/pr-approve'
import { updatePRDetails } from '../../github/client/update/pr-details'
import { getPRBody } from '../../github/client/update/pr-body'
import type { Store } from '../../persistence/loading-store/store'
import {
  assertRegisteredGitHubRepo,
  getGitHubLocalGitOptionArgs,
  getGitHubRepoConnectionId,
  type GitHubRepoScopedArgs
} from './github-repo-routing'
import { broadcastGitHubWorkItemMutation } from './github-work-item-mutation-events'

function broadcastSuccessfulPRMutation(
  ok: boolean,
  repoPath: string,
  repoId: string,
  prNumber: number,
  senderId: number
): void {
  if (ok) {
    broadcastGitHubWorkItemMutation({ repoPath, repoId, type: 'pr', number: prNumber }, senderId)
  }
}

/** The workspace layout's PR actions Orca lacked: read and edit the description, approve. */
export function registerRevioPRHandlers(store: Store): void {
  ipcMain.handle(
    'gh:prBody',
    async (
      _event,
      args: GitHubRepoScopedArgs & { prNumber: number; prRepo?: GitHubOwnerRepo | null }
    ) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      return getPRBody(
        repo.path,
        args.prNumber,
        getGitHubRepoConnectionId(repo),
        args.prRepo ?? null,
        ...getGitHubLocalGitOptionArgs(store, repo)
      )
    }
  )

  ipcMain.handle(
    'gh:updatePRBody',
    async (
      event,
      args: GitHubRepoScopedArgs & {
        prNumber: number
        body: string
        prRepo?: GitHubOwnerRepo | null
      }
    ) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      if (typeof args.body !== 'string' || args.body.length > 65_536) {
        return { ok: false, error: 'Invalid pull request description' }
      }
      const result = await updatePRDetails(
        repo.path,
        args.prNumber,
        { body: args.body },
        getGitHubRepoConnectionId(repo),
        args.prRepo ?? null,
        ...getGitHubLocalGitOptionArgs(store, repo)
      )
      broadcastSuccessfulPRMutation(result.ok, repo.path, repo.id, args.prNumber, event.sender.id)
      return result
    }
  )

  ipcMain.handle(
    'gh:approvePR',
    async (
      event,
      args: GitHubRepoScopedArgs & { prNumber: number; prRepo?: GitHubOwnerRepo | null }
    ) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      if (!Number.isInteger(args.prNumber) || args.prNumber < 1) {
        return { ok: false, error: 'Invalid pull request number' }
      }
      const result = await approvePR(
        repo.path,
        args.prNumber,
        getGitHubRepoConnectionId(repo),
        args.prRepo ?? null,
        ...getGitHubLocalGitOptionArgs(store, repo)
      )
      broadcastSuccessfulPRMutation(result.ok, repo.path, repo.id, args.prNumber, event.sender.id)
      return result
    }
  )
}
