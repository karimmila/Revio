import type { ActionRunLocation } from '../../shared/actions/repo-action-runnables'
import type {
  RepoActionListResult,
  RepoActionRunResult
} from '../../shared/actions/repo-action-agent-results'
import { resolveCurrentAgentWorkspaceSelector } from '../agent-workspace-selector'
import { formatActionList, formatActionRun, type ActionRunOutput } from '../action-format'
import { DEFAULT_ACTION_WAIT_MS, MAX_ACTION_WAIT_MS, waitForActionRun } from '../action-run-wait'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { normalizeWorktreeSelectorForCaller } from '../selectors'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

// The window may take a few seconds to open the Run tab and report its terminal.
const RUN_CALL_TIMEOUT_MS = 40_000

async function workspaceSelector(ctx: Pick<HandlerContext, 'flags' | 'cwd' | 'client'>) {
  const explicit = getOptionalStringFlag(ctx.flags, 'worktree')
  return !explicit || explicit === 'active' || explicit === 'current'
    ? resolveCurrentAgentWorkspaceSelector(ctx.cwd, ctx.client)
    : normalizeWorktreeSelectorForCaller(explicit, ctx.cwd, ctx.client)
}

export function parseActionLocation(value: string | undefined): ActionRunLocation | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === 'local' || value === 'cloud' || value === 'mirror') {
    return value
  }
  throw new RuntimeClientError('invalid_argument', '--location must be local, cloud or mirror')
}

export function parseActionWaitMs(flags: Map<string, string | boolean>): number | null {
  if (flags.get('wait') !== true) {
    if (flags.has('timeout-ms')) {
      throw new RuntimeClientError('invalid_argument', '--timeout-ms needs --wait')
    }
    return null
  }
  const timeout = getOptionalPositiveIntegerFlag(flags, 'timeout-ms') ?? DEFAULT_ACTION_WAIT_MS
  if (timeout > MAX_ACTION_WAIT_MS) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--timeout-ms can be at most ${MAX_ACTION_WAIT_MS}`
    )
  }
  return timeout
}

// Why the runtime's method_not_found is rewritten: an older Orca has no action methods, and the
// raw code reads as a CLI bug.
function rethrowOldRuntime(error: unknown): never {
  if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
    throw new RuntimeClientError(
      'incompatible_runtime',
      `This ${FORK_PRODUCT_NAME} cannot list or run repository actions yet. Update ${FORK_PRODUCT_NAME} and try again.`
    )
  }
  throw error
}

export const ACTION_HANDLERS: Record<string, CommandHandler> = {
  'action list': async (ctx) => {
    const worktree = await workspaceSelector(ctx)
    const response = await ctx.client
      .call<RepoActionListResult>('repoAction.list', { worktree })
      .catch(rethrowOldRuntime)
    printResult(response, ctx.json, formatActionList)
  },
  'action run': async (ctx) => {
    const action = getRequiredStringFlag(ctx.flags, 'action')
    const location = parseActionLocation(getOptionalStringFlag(ctx.flags, 'location'))
    const waitMs = parseActionWaitMs(ctx.flags)
    const worktree = await workspaceSelector(ctx)
    const response = await ctx.client
      .call<RepoActionRunResult>(
        'repoAction.run',
        {
          worktree,
          action,
          ...(location ? { location } : {}),
          ...(ctx.flags.get('restart') === true ? { restart: true } : {})
        },
        { timeoutMs: RUN_CALL_TIMEOUT_MS }
      )
      .catch(rethrowOldRuntime)
    const result: ActionRunOutput = { ...response.result }
    if (waitMs !== null && result.terminal) {
      result.wait = await waitForActionRun(ctx.client, result.terminal, result.action.name, waitMs)
    }
    printResult({ ...response, result }, ctx.json, formatActionRun)
  }
}
