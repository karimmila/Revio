import { describe, expect, it } from 'vitest'
import { recentTerminalOutput, terminalBufferLines } from './terminal-recent-output'

describe('recentTerminalOutput', () => {
  it('keeps the last lines and drops blank rows under the prompt', () => {
    expect(recentTerminalOutput(['a', 'b  ', 'c', '', '   '], 2)).toBe('b\nc')
  })

  it('is empty for an empty terminal', () => {
    expect(recentTerminalOutput(['', ' '])).toBe('')
  })

  it('reads the last buffer rows as text', () => {
    const rows = ['$ npm test', 'FAIL x']
    const buffer = {
      length: rows.length,
      getLine: (index: number) => ({ translateToString: () => rows[index] ?? '' })
    }
    expect(terminalBufferLines(buffer)).toEqual(rows)
    expect(terminalBufferLines(buffer, 1)).toEqual(['FAIL x'])
  })
})
