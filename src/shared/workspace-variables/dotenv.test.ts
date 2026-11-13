import { describe, expect, it } from 'vitest'
import { formatDotenv, isReservedVariableKey, parseDotenv } from './dotenv'

describe('workspace variables .env format', () => {
  it('reads KEY=value lines, skipping comments, blanks, export and bad names', () => {
    const text = [
      '# comment',
      '',
      'export API_KEY=abc',
      'QUOTED="hello world"',
      "SINGLE='x=y'",
      'INLINE=value # trailing note',
      '1BAD=no',
      'NOEQUALS'
    ].join('\n')
    expect(parseDotenv(text)).toEqual({
      API_KEY: 'abc',
      QUOTED: 'hello world',
      SINGLE: 'x=y',
      INLINE: 'value'
    })
  })

  it('round-trips values that need quoting', () => {
    const values = {
      PLAIN: 'abc-123',
      SPACED: 'a b',
      QUOTE: 'say "hi"',
      LINES: 'one\ntwo',
      SLASH: 'a\\b'
    }
    expect(parseDotenv(formatDotenv(values))).toEqual(values)
  })

  it('reserves the shell identity and Orca internals', () => {
    expect(isReservedVariableKey('PATH')).toBe(true)
    expect(isReservedVariableKey('LC_ALL')).toBe(true)
    expect(isReservedVariableKey('ORCA_ANYTHING')).toBe(true)
    expect(isReservedVariableKey('OPENAI_API_KEY')).toBe(false)
  })
})
