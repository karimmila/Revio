import { expect, it } from 'vitest'
import { storedItemBody } from './journal-storage-schema'

it('a stored compaction row keeps its summary, and a stored row from before it still reads', () => {
  const row = {
    kind: 'status' as const,
    text: 'Context compacted',
    presentation: 'compaction',
    compactSummary: 'We fixed the parser.'
  }
  expect(storedItemBody.parse(JSON.parse(JSON.stringify(row)))).toEqual(row)
  const older = { kind: 'status' as const, text: 'Context compacted', presentation: 'compaction' }
  expect(storedItemBody.parse(older)).toEqual(older)
})
