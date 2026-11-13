import type { NativeChatMessage } from '../native-chat-types'
import type { NativeChatTurnFoldRow } from './native-chat-turn-fold'

export type NativeChatTurnFoldSummary = { toolCalls: number; messages: number }

/** What a settled turn's fold hides, per turn: its tool calls and its non-answer messages
 * ("Expand 12 tool calls, 3 messages"). */
export function nativeChatTurnFoldSummaries(
  messages: readonly Pick<NativeChatMessage, 'blocks'>[],
  rows: readonly Pick<NativeChatTurnFoldRow, 'turnKey' | 'rendersProse'>[],
  foldableRows: ReadonlySet<number>
): Map<string, NativeChatTurnFoldSummary> {
  const byTurn = new Map<string, NativeChatTurnFoldSummary>()
  for (const index of foldableRows) {
    const row = rows[index]
    const message = messages[index]
    if (!row?.turnKey || !message) {
      continue
    }
    const summary = byTurn.get(row.turnKey) ?? { toolCalls: 0, messages: 0 }
    summary.toolCalls += message.blocks.filter((block) => block.type === 'tool-call').length
    summary.messages += row.rendersProse ? 1 : 0
    byTurn.set(row.turnKey, summary)
  }
  return byTurn
}
