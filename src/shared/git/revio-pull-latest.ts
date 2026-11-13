/**
 * What the workspace layout's "Pull latest from <target>" did, or why it handed the branch to the
 * agent.
 */
export type PullLatestOutcome =
  | { kind: 'up-to-date'; base: string }
  | { kind: 'fast-forwarded'; base: string }
  | { kind: 'agent'; base: string; reason: 'diverged' | 'uncommitted'; rebase: boolean }

/**
 * Up to date, fast-forward when only behind, else the agent integrates (the workspace layout never
 * rebases itself).
 */
export function decidePullLatest(args: {
  base: string
  ahead: number
  behind: number
  dirty: boolean
  pullRebase: boolean
}): 'up-to-date' | 'fast-forwarded' | 'diverged' | 'uncommitted' {
  if (args.behind === 0) {
    return 'up-to-date'
  }
  if (args.dirty) {
    return 'uncommitted'
  }
  return args.ahead === 0 ? 'fast-forwarded' : 'diverged'
}

/** `git config pull.rebase` values that make `git pull` rebase. */
export function pullRebaseEnabled(value: string): boolean {
  return ['true', 'merges', 'interactive', 'preserve', 'i', 'm', 'p'].includes(
    value.trim().toLowerCase()
  )
}

/** The agent's instruction for a branch the app will not integrate itself. */
export function pullLatestAgentPrompt(outcome: {
  base: string
  reason: 'diverged' | 'uncommitted'
  rebase: boolean
}): string {
  const integrate = outcome.rebase
    ? `Rebase this branch onto ${outcome.base}. Then push --force-with-lease.`
    : `Merge ${outcome.base} into this branch. Then push.`
  return outcome.reason === 'uncommitted'
    ? `Commit uncommitted changes, then ${integrate.charAt(0).toLowerCase()}${integrate.slice(1)}`
    : integrate
}
