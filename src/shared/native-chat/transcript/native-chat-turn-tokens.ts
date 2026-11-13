import type { AgentSessionContextUsage } from '../../agent-session/agent-session-context-usage'

/** A settled turn's token counts (turn stats: Input, Output, Cache read, Cache write). */
export type NativeChatTurnTokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** The provider's token usage the host stored on the turn record; null when it reported only a
 * context percentage (or nothing). */
export function nativeChatTurnTokens(
  usage: AgentSessionContextUsage | undefined
): NativeChatTurnTokens | null {
  const used = usage?.used
  if (used?.kind !== 'estimate') {
    return null
  }
  return {
    input: used.usage.inputTokens,
    output: used.usage.outputTokens,
    cacheRead: used.usage.cacheReadInputTokens,
    cacheWrite: used.usage.cacheCreationInputTokens
  }
}

export function formatNativeChatTurnTokens(tokens: NativeChatTurnTokens): string {
  const n = (value: number): string => value.toLocaleString()
  return `Input ${n(tokens.input)} · Output ${n(tokens.output)} · Cache read ${n(tokens.cacheRead)} · Cache write ${n(tokens.cacheWrite)}`
}
