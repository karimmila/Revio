import { defineMethod, type RpcContext } from '../../core'
import {
  RepoActionListParams,
  RepoActionRunParams
} from '../../../../../shared/rpc-contract/repo-action-params'
import { readRepoActions } from '../../../../actions/repo-actions-store'
import { askRendererForRepoAction } from '../../../../actions/repo-action-renderer-request'
import {
  listWorkspaceRepoActions,
  runWorkspaceRepoAction,
  type RepoActionAgentServiceDeps
} from './repo-action-agent-service'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'

function serviceDeps({ runtime }: RpcContext): RepoActionAgentServiceDeps {
  return {
    resolveWorktreeId: async (selector) => (await runtime.showManagedWorktree(selector)).id,
    getRepo: (repoId) => runtime.listRepos().find((repo) => repo.id === repoId),
    readActions: readRepoActions,
    askRenderer: (body) =>
      askRendererForRepoAction(
        runtime.getAuthoritativeWindow(`Open ${FORK_PRODUCT_NAME} to run repository actions.`),
        body
      ),
    waitForTerminalHandle: (tabId) => runtime.waitForTerminalHandle(tabId)
  }
}

/** `orca action list|run`: agents list the workspace's repository actions and start one. */
export const REPO_ACTION_METHODS = [
  defineMethod({
    name: 'repoAction.list',
    permission: 'workspace',
    params: RepoActionListParams,
    handler: async (params, ctx) => listWorkspaceRepoActions(serviceDeps(ctx), params.worktree)
  }),
  defineMethod({
    name: 'repoAction.run',
    permission: 'workspace',
    params: RepoActionRunParams,
    handler: async (params, ctx) => runWorkspaceRepoAction(serviceDeps(ctx), params)
  })
]
