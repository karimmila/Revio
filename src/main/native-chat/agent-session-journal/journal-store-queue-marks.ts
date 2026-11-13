import type { AgentJournalCursor } from '../../../shared/agent-session/journal/agent-session-journal-identity'
import {
  journalQueueResumeRowBuilder,
  journalQueuePauseRowBuilder,
  journalQueueReopenRowBuilder,
  journalStopEventRowBuilder
} from './context-epochs/journal-stop-and-resume-rows'
import type { JournalStopEvent } from './durable-rows/journal-row-schema'
import type { JournalReducerState } from './projection/journal-reducer'
import type { JournalOperationReceipt, JournalRowWriter } from './writing/journal-row-writer'

type JournalRowAppender = Pick<JournalRowWriter, 'append'>

export function createJournalQueueMarkAppends(
  state: () => JournalReducerState,
  rowWriter: () => JournalRowAppender
) {
  return {
    stopEvent(event: Omit<JournalStopEvent, 'at'>, fence: number): Promise<AgentJournalCursor> {
      return rowWriter().append(journalStopEventRowBuilder(state, event, fence))
    },
    resume(fence: number, receipt?: JournalOperationReceipt): Promise<AgentJournalCursor> {
      return rowWriter().append(journalQueueResumeRowBuilder(state, fence), receipt)
    },
    pause(fence: number, receipt?: JournalOperationReceipt): Promise<AgentJournalCursor> {
      return rowWriter().append(journalQueuePauseRowBuilder(state, fence), receipt)
    },
    reopen(fence: number, since?: number): Promise<AgentJournalCursor> {
      return rowWriter().append(journalQueueReopenRowBuilder(state, fence, since))
    }
  }
}
