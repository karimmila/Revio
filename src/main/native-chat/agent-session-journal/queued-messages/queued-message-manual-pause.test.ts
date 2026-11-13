import { expect, it } from 'vitest'
import {
  createJournalQueuePauseMarks,
  deriveQueuePauses,
  foldJournalQueuePauseMark,
  journalQueueManuallyPaused
} from './queued-message-pause'
import { outcomeFormat1StoredScalars } from '../outcomes/journal-outcome-format-1'
import { journalRowDeclaresMore } from '../durable-rows/journal-storage-row-schema'

const tombstone = (seq: number, mark: 'queuePause' | 'queueResume') => ({
  kind: 'tombstone' as const,
  v: 1,
  itemId: `orca:${mark}`,
  revision: 1,
  epoch: 'e',
  seq,
  fence: 0,
  ts: seq,
  [mark]: true as const
})

it('a Pause row holds the queue until a later Resume row, whatever turns run', () => {
  const marks = createJournalQueuePauseMarks()
  foldJournalQueuePauseMark(marks, tombstone(5, 'queuePause'))
  expect(journalQueueManuallyPaused(marks)).toBe(true)
  const cards = [{ messageId: 'a', state: 'waiting', holdReason: null, queuedAt: null }]
  const pauses = deriveQueuePauses({
    epoch: 'e',
    marks,
    latestAcceptedTurnSequence: 9,
    cards,
    reopenFloor: null
  })
  expect(pauses).toContainEqual({ reason: 'paused', since: null })
  foldJournalQueuePauseMark(marks, tombstone(10, 'queueResume'))
  expect(journalQueueManuallyPaused(marks)).toBe(false)
})

it('the stored pause marks keep pausedSequence, and marks stored before it still read', () => {
  const marks = { latestStop: null, resumedSequence: 2, reopenedSequence: 0, pausedSequence: 7 }
  const shape = outcomeFormat1StoredScalars.shape.queuePauseMarks
  expect(shape.parse(JSON.parse(JSON.stringify(marks)))).toEqual(marks)
  const older = { latestStop: null, resumedSequence: 2, reopenedSequence: 0 }
  expect(shape.parse(older)).toEqual(older)
})

it("the storage schema declares the Pause row's marker", () => {
  expect(journalRowDeclaresMore(tombstone(3, 'queuePause'))).toBe(false)
})
