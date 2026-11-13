import type { ActionContext, ActionRunLocation } from './repo-action-runnables'

/** Main asks the window to resolve a workspace's action context, or to start one of its actions. */
export type RepoActionAgentRequest =
  | { requestId: string; op: 'context'; worktreeId: string }
  | {
      requestId: string
      op: 'run'
      worktreeId: string
      actionId: string
      location: ActionRunLocation
      /** Stop a run of this action that is still going, then start it again. */
      restart: boolean
    }

/** A request as its sender writes it; the bridge adds the request id. */
export type RepoActionAgentRequestBody = RepoActionAgentRequest extends infer T
  ? T extends RepoActionAgentRequest
    ? Omit<T, 'requestId'>
    : never
  : never

export type RepoActionAgentRunResult = {
  /** The Run tab the action runs in; null when the tab could not be found after starting. */
  tabId: string | null
  /** The workspace the run belongs to (a cloud workspace's mirror, or the Spotlight root). */
  worktreeId: string
  /** The action was still running and was left alone (no restart asked). */
  alreadyRunning: boolean
}

export type RepoActionAgentReply = {
  requestId: string
  error?: string
  context?: ActionContext | null
  run?: RepoActionAgentRunResult
}

export const REPO_ACTION_AGENT_REQUEST_CHANNEL = 'actions:agentRequest'
export const REPO_ACTION_AGENT_REPLY_CHANNEL = 'actions:agentReply'

/**
 * An agent-started run ends with a dim `■ <name> exited <code>` line, so `orca action run --wait`
 * can tell a finished script from the shell that stays open in the Run tab.
 */
export const REPO_ACTION_EXIT_MARKER = '■'

export function parseRepoActionExit(line: string, actionName: string): number | null {
  const prefix = `${REPO_ACTION_EXIT_MARKER} ${actionName} exited `
  const at = line.lastIndexOf(prefix)
  if (at === -1) {
    return null
  }
  const code = Number.parseInt(line.slice(at + prefix.length).trim(), 10)
  return Number.isInteger(code) ? code : null
}
