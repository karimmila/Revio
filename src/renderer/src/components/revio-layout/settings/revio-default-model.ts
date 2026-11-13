import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

/**
 * The one "Default model" list spans every chat agent, so a pick names both the agent
 * and the model. Orca stores them apart: the agent in `defaultTuiAgent`, the model per agent.
 */
export type RevioDefaultModelPick = { agent: TuiAgent; modelId: string }

const SEPARATOR = '::'

export function encodeDefaultModel(pick: RevioDefaultModelPick): string {
  return `${pick.agent}${SEPARATOR}${pick.modelId}`
}

export function decodeDefaultModel(
  value: string,
  agents: readonly TuiAgent[]
): RevioDefaultModelPick | null {
  const at = value.indexOf(SEPARATOR)
  if (at <= 0) {
    return null
  }
  const agent = agents.find((candidate) => candidate === value.slice(0, at))
  const modelId = value.slice(at + SEPARATOR.length)
  return agent && modelId ? { agent, modelId } : null
}

/** Workspace layout chats fall back to Claude when no agent (or "blank") is the default. */
export function revioChatAgent(
  defaultTuiAgent: TuiAgent | 'blank' | null | undefined,
  agents: readonly TuiAgent[]
): TuiAgent {
  return defaultTuiAgent && defaultTuiAgent !== 'blank' && agents.includes(defaultTuiAgent)
    ? defaultTuiAgent
    : 'claude'
}
