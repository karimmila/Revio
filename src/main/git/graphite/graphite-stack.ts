import { commandExecFileAsync, gitExecFileAsync } from '../runner'
import { readGraphiteMetadataState } from './graphite-branch-metadata'
import type { GraphiteStack, GraphiteStackBranch } from '../../../shared/git/graphite-stack-types'

type StateEntry = { trunk?: unknown; needs_restack?: unknown; parents?: unknown }

function parentOf(entry: StateEntry | undefined): string | null {
  if (!entry || !Array.isArray(entry.parents)) {
    return null
  }
  const first: unknown = entry.parents[0]
  if (first && typeof first === 'object' && 'ref' in first && typeof first.ref === 'string') {
    return first.ref
  }
  return null
}

/**
 * The current branch's Graphite stack from `gt state` JSON: its descendants (first child each
 * level), the branch, then its parents down to trunk. Null when the branch is untracked or trunk.
 */
export function buildGraphiteStack(stateJson: string, currentBranch: string): GraphiteStack {
  let state: Record<string, StateEntry>
  try {
    const parsed: unknown = JSON.parse(stateJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    state = Object.fromEntries(Object.entries(parsed))
  } catch {
    return null
  }
  const current = state[currentBranch]
  if (!current || current.trunk === true) {
    return null
  }
  const branch = (name: string): GraphiteStackBranch => ({
    name,
    trunk: state[name]?.trunk === true,
    needsRestack: state[name]?.needs_restack === true,
    current: name === currentBranch
  })
  const seen = new Set<string>([currentBranch])
  const below: GraphiteStackBranch[] = []
  for (let parent = parentOf(current); parent && !seen.has(parent);) {
    seen.add(parent)
    below.push(branch(parent))
    parent = state[parent]?.trunk === true ? null : parentOf(state[parent])
  }
  const above: GraphiteStackBranch[] = []
  for (let tip = currentBranch; ;) {
    const child = Object.keys(state).find(
      (name) => !seen.has(name) && parentOf(state[name]) === tip
    )
    if (!child) {
      break
    }
    seen.add(child)
    above.unshift(branch(child))
    tip = child
  }
  return { branches: [...above, branch(currentBranch), ...below] }
}

/** Read-only: runs `gt state` in the worktree; null when gt is missing or the branch is not stacked. */
export async function readGraphiteStack(worktreePath: string): Promise<GraphiteStack> {
  try {
    const { stdout: head } = await gitExecFileAsync(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: worktreePath
    })
    // Without the gt CLI, Graphite's own refs/branch-metadata still give the stack (lane gitpr).
    const state = await commandExecFileAsync('gt', ['state'], { cwd: worktreePath, timeout: 8000 })
      .then((result) => result.stdout)
      .catch(() => readGraphiteMetadataState(worktreePath))
    return buildGraphiteStack(state, head.trim())
  } catch {
    return null
  }
}

/** "Checkout this branch": switches the worktree to a branch of its own Graphite stack. */
export async function checkoutGraphiteBranch(
  worktreePath: string,
  branchName: string
): Promise<void> {
  const stack = await readGraphiteStack(worktreePath)
  if (
    branchName.startsWith('-') ||
    !stack?.branches.some((candidate) => candidate.name === branchName && !candidate.trunk)
  ) {
    throw new Error('Not a branch of this Graphite stack')
  }
  await gitExecFileAsync(['switch', branchName], { cwd: worktreePath })
}
