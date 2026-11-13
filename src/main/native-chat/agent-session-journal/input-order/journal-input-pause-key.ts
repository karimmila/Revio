import type { JournalReducerState } from '../projection/journal-reducer'
import { journalInputOrder } from './journal-input-order'
import {
  journalQueueManuallyPaused,
  journalQueueStopHolds,
  failedQueueTurnSequence,
  type DerivedQueuePause
} from '../queued-messages/queued-message-pause'

type QueuePauseMarks = JournalReducerState['queuePauseMarks']

export type JournalInputPauseKey = readonly [
  QueuePauseMarks['latestStop'] | null,
  number,
  QueuePauseMarks['cleared'] | null,
  ReturnType<typeof journalQueueManuallyPaused>
]

export function journalInputFailureHolds(state: JournalReducerState): boolean {
  const failure = journalInputOrder(state).newestTurn.failure()
  return failedQueueTurnSequence(failure, state.queuePauseMarks.resumedSequence) > 0
}

export function journalInputPauseKey(
  state: JournalReducerState,
  floor: { epoch: string; sequence: number } | null
): { pauseKey: JournalInputPauseKey; reopened: number } {
  const marks = state.queuePauseMarks
  const lifted = Math.max(state.latestAcceptedTurnSequence, marks.resumedSequence)
  const reopened = Math.max(
    marks.reopenedSequence,
    floor?.epoch === state.epoch ? floor.sequence : 0
  )
  const pauseKey: JournalInputPauseKey = [
    journalQueueStopHolds(marks, state.latestAcceptedTurnSequence) ? marks.latestStop : null,
    reopened > lifted ? reopened : 0,
    marks.cleared && !marks.cleared.lifted && marks.cleared.sequence > lifted
      ? marks.cleared
      : null,
    // The person's own Pause holds everything until Resume, whatever turns ran since.
    journalQueueManuallyPaused(marks)
  ]
  return { pauseKey, reopened }
}

export function journalInputPauses(
  state: JournalReducerState,
  pauseKey: JournalInputPauseKey,
  reopened: number
): readonly DerivedQueuePause[] {
  const latestStop = state.queuePauseMarks.latestStop
  return [
    ...(pauseKey[0] && latestStop
      ? [
          {
            reason: 'stopped' as const,
            since: { epoch: state.epoch, sequence: latestStop.sequence }
          }
        ]
      : []),
    ...(pauseKey[1]
      ? [{ reason: 'restarted' as const, since: { epoch: state.epoch, sequence: reopened } }]
      : []),
    ...(pauseKey[3] ? [{ reason: 'paused' as const, since: null }] : [])
  ]
}
