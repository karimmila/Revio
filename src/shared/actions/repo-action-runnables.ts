import type { RepoAction } from './repo-actions'

/** Where a run happens: this Mac, a cloud workspace's sandbox, or a cloud workspace's local mirror. */
export type ActionRunLocation = 'local' | 'cloud' | 'mirror'

/** Where a workspace's actions come from and where each kind runs. */
export type ActionContext = {
  kind: ActionRunLocation
  /** The local repository the actions are defined on (a cloud workspace's source repository). */
  sourceRepoId: string
  worktreeId: string
  /** For a cloud workspace whose mirror exists: the mirror's workspace on this Mac. */
  mirrorWorktreeId: string | null
}

export type Runnable = {
  action: RepoAction
  worktreeId: string
  group: ActionRunLocation
}

/** The actions this workspace can run, each paired with the workspace it runs in. */
export function runnableActions(
  context: ActionContext,
  actions: readonly RepoAction[]
): Runnable[] {
  const result: Runnable[] = []
  for (const action of actions) {
    if (context.kind === 'cloud') {
      if (action.targets.includes('cloud')) {
        result.push({ action, worktreeId: context.worktreeId, group: 'cloud' })
      }
      if (action.targets.includes('mirror') && context.mirrorWorktreeId) {
        result.push({ action, worktreeId: context.mirrorWorktreeId, group: 'mirror' })
      }
    } else if (action.targets.includes(context.kind)) {
      result.push({ action, worktreeId: context.worktreeId, group: context.kind })
    }
  }
  return result
}

const LOCATION_LABEL: Record<ActionRunLocation, string> = {
  local: 'this Mac',
  cloud: 'cloud workspaces',
  mirror: "a cloud workspace's local mirror"
}

export type AgentActionSelection =
  | { ok: true; runnable: Runnable }
  | { ok: false; code: 'not_found' | 'unavailable_here' | 'ambiguous'; message: string }

function matchesQuery(action: RepoAction, query: string): boolean {
  return action.id === query || action.name.toLowerCase() === query.toLowerCase()
}

/**
 * The run an agent asked for by action id or name. Only actions defined for the repository can be
 * chosen, and only where this workspace can run them, so a caller never supplies a script.
 */
export function selectAgentAction(
  context: ActionContext,
  actions: readonly RepoAction[],
  query: string,
  location?: ActionRunLocation
): AgentActionSelection {
  const wanted = query.trim()
  const named = actions.filter((action) => matchesQuery(action, wanted))
  if (named.length === 0) {
    const known = actions.map((action) => `"${action.name}"`).join(', ')
    return {
      ok: false,
      code: 'not_found',
      message: known
        ? `No action named "${wanted}". This repository's actions: ${known}.`
        : `No action named "${wanted}". This repository has no actions.`
    }
  }
  const runnables = runnableActions(context, named).filter(
    (entry) => location === undefined || entry.group === location
  )
  if (runnables.length === 0) {
    const action = named[0]
    const where = action?.targets.map((target) => LOCATION_LABEL[target]).join(', ') || 'nowhere'
    const here =
      location === 'mirror' && context.kind === 'cloud'
        ? 'this cloud workspace has no local mirror'
        : `this workspace is ${context.kind === 'local' ? 'on this Mac' : `a ${context.kind} workspace`}`
    return {
      ok: false,
      code: 'unavailable_here',
      message: `Action "${action?.name ?? wanted}" can run in ${where}, but ${here}${location ? ` (asked for --location ${location})` : ''}.`
    }
  }
  const [first, ...rest] = runnables
  if (!first) {
    return { ok: false, code: 'not_found', message: `No action named "${wanted}".` }
  }
  if (rest.some((entry) => entry.action.id !== first.action.id)) {
    return {
      ok: false,
      code: 'ambiguous',
      message: `More than one action is named "${wanted}". Pass its id: ${runnables
        .map((entry) => entry.action.id)
        .join(', ')}.`
    }
  }
  return { ok: true, runnable: first }
}
