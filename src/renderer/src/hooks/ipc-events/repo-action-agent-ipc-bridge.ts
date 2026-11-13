import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../store'
import { resolveActionContext, runningRepoActionTab, stopRepoAction } from '@/lib/repo-action-run'
import { startRunnable } from '@/components/revio-layout/revio-action-start'
import { runnableActions } from '../../../../shared/actions/repo-action-runnables'
import type {
  RepoActionAgentReply,
  RepoActionAgentRequest
} from '../../../../shared/actions/repo-action-agent-bridge'

export type RepoActionAgentDeps = {
  resolveContext: typeof resolveActionContext
  listActions: NonNullable<typeof window.api.repoActions>['list']
  runningTab: typeof runningRepoActionTab
  stop: typeof stopRepoAction
  start: typeof startRunnable
  spotlightRepos: () => readonly string[]
}

/**
 * Answers main's request for `orca action`: the workspace's action context, or a run started
 * through the Run button's own start path. Main has already checked that the action exists and
 * may run here; the script is read again from the repository's actions, never from the request.
 */
export async function handleRepoActionAgentRequest(
  request: RepoActionAgentRequest,
  deps: RepoActionAgentDeps
): Promise<RepoActionAgentReply> {
  const { requestId } = request
  const context = await deps.resolveContext(request.worktreeId)
  if (request.op === 'context') {
    return { requestId, context }
  }
  if (!context) {
    return {
      requestId,
      error: translate(
        'auto.hooks.repoActionAgent.noActions',
        'This workspace has no repository actions.'
      )
    }
  }
  const listed = await deps.listActions(context.sourceRepoId)
  const entry = runnableActions(context, listed.actions).find(
    (candidate) => candidate.action.id === request.actionId && candidate.group === request.location
  )
  if (!entry) {
    return {
      requestId,
      error: translate(
        'auto.hooks.repoActionAgent.unavailable',
        'That action is not available in this workspace.'
      )
    }
  }
  const running = deps.runningTab(entry.action.id, entry.worktreeId)
  if (running && !request.restart) {
    return {
      requestId,
      run: { tabId: running, worktreeId: entry.worktreeId, alreadyRunning: true }
    }
  }
  if (running) {
    deps.stop(entry.action.id, entry.worktreeId)
  }
  const spotlight = context.kind === 'local' && deps.spotlightRepos().includes(context.sourceRepoId)
  const started = await deps.start(context, entry, listed.runMode, spotlight)
  if (started === 'declined') {
    return {
      requestId,
      error: translate(
        'auto.hooks.repoActionAgent.notApproved',
        'The person did not approve running {{name}}.',
        { name: entry.action.name }
      )
    }
  }
  if (!started) {
    return {
      requestId,
      error: translate('auto.hooks.repoActionAgent.startFailed', 'Could not start {{name}}.', {
        name: entry.action.name
      })
    }
  }
  return { requestId, run: { ...started, alreadyRunning: false } }
}

export function registerRepoActionAgentIpcBridge(unsubs: (() => void)[]): void {
  const api = window.api.repoActions
  if (!api?.onAgentRequest) {
    return
  }
  const deps: RepoActionAgentDeps = {
    resolveContext: resolveActionContext,
    listActions: api.list,
    runningTab: runningRepoActionTab,
    stop: stopRepoAction,
    start: startRunnable,
    spotlightRepos: () => useAppStore.getState().settings?.revioSpotlightRepos ?? []
  }
  unsubs.push(
    api.onAgentRequest((request) => {
      void handleRepoActionAgentRequest(request, deps)
        .catch((error: unknown) => ({
          requestId: request.requestId,
          error: error instanceof Error ? error.message : String(error)
        }))
        .then((reply) => api.replyAgentRequest(reply))
    })
  )
}
