import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

/**
 * An emptied path field goes back to the agent's own command, so the key is dropped rather than
 * stored as "".
 */
export function withAgentCommandOverride(
  overrides: Partial<Record<TuiAgent, string>>,
  agent: TuiAgent,
  draft: string
): Partial<Record<TuiAgent, string>> {
  const next = { ...overrides }
  const value = draft.trim()
  if (value) {
    next[agent] = value
  } else {
    delete next[agent]
  }
  return next
}

/** The preset row counts, plus a custom count saved elsewhere so the select can still show it. */
export function scrollbackChoices(presets: readonly number[], current: number): number[] {
  return presets.includes(current) ? [...presets] : [...presets, current].sort((a, b) => a - b)
}
