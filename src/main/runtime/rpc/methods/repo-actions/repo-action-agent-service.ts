import type { ActionRunMode, RepoAction } from '../../../../../shared/actions/repo-actions'
import {
  runnableActions,
  selectAgentAction,
  type ActionContext,
  type ActionRunLocation
} from '../../../../../shared/actions/repo-action-runnables'
import type {
  RepoActionAgentReply,
  RepoActionAgentRequestBody
} from '../../../../../shared/actions/repo-action-agent-bridge'
import type { Repo } from '../../../../../shared/repo-types'
import type {
  RepoActionListResult,
  RepoActionRunResult
} from '../../../../../shared/actions/repo-action-agent-results'
import { InvalidArgumentError } from '../../core'

export type RepoActionAgentServiceDeps = {
  resolveWorktreeId: (selector: string) => Promise<string>
  getRepo: (repoId: string) => Pick<Repo, 'id' | 'path'> | undefined
  readActions: (repo: Pick<Repo, 'id' | 'path'>) => {
    actions: RepoAction[]
    runMode: ActionRunMode
    sharedError: string | null
  }
  askRenderer: (body: RepoActionAgentRequestBody) => Promise<RepoActionAgentReply>
  waitForTerminalHandle: (tabId: string) => Promise<string>
}

async function loadWorkspaceActions(deps: RepoActionAgentServiceDeps, selector: string) {
  const worktreeId = await deps.resolveWorktreeId(selector)
  const reply = await deps.askRenderer({ op: 'context', worktreeId })
  if (reply.error) {
    throw new Error(reply.error)
  }
  const context: ActionContext | null | undefined = reply.context
  const repo = context ? deps.getRepo(context.sourceRepoId) : undefined
  if (!context || !repo) {
    throw new InvalidArgumentError('This workspace has no repository actions.')
  }
  return { context, listed: deps.readActions(repo) }
}

export async function listWorkspaceRepoActions(
  deps: RepoActionAgentServiceDeps,
  selector: string
): Promise<RepoActionListResult> {
  const { context, listed } = await loadWorkspaceActions(deps, selector)
  const runnables = runnableActions(context, listed.actions)
  return {
    worktreeId: context.worktreeId,
    location: context.kind,
    runMode: listed.runMode,
    sharedError: listed.sharedError,
    actions: listed.actions.map((action) => ({
      id: action.id,
      name: action.name,
      script: action.script,
      shared: action.shared,
      targets: action.targets,
      runsIn: runnables.filter((entry) => entry.action.id === action.id).map((entry) => entry.group)
    }))
  }
}

export async function runWorkspaceRepoAction(
  deps: RepoActionAgentServiceDeps,
  params: { worktree: string; action: string; location?: ActionRunLocation; restart?: boolean }
): Promise<RepoActionRunResult> {
  const { context, listed } = await loadWorkspaceActions(deps, params.worktree)
  const selection = selectAgentAction(context, listed.actions, params.action, params.location)
  if (!selection.ok) {
    throw new InvalidArgumentError(selection.message)
  }
  const { runnable } = selection
  const reply = await deps.askRenderer({
    op: 'run',
    worktreeId: context.worktreeId,
    actionId: runnable.action.id,
    location: runnable.group,
    restart: params.restart === true
  })
  if (reply.error || !reply.run) {
    throw new Error(reply.error ?? `Could not start ${runnable.action.name}.`)
  }
  const terminal = reply.run.tabId
    ? await deps.waitForTerminalHandle(reply.run.tabId).catch(() => null)
    : null
  return {
    action: { id: runnable.action.id, name: runnable.action.name },
    location: runnable.group,
    worktreeId: reply.run.worktreeId,
    terminal,
    alreadyRunning: reply.run.alreadyRunning
  }
}
