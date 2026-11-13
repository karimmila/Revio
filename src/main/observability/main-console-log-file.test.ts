import { describe, expect, it } from 'vitest'
import { formatMainLogLine } from './main-console-log-file'

const options = { now: new Date('2026-11-12T10:00:00.000Z'), home: '/Users/someone' }

describe('formatMainLogLine', () => {
  it('redacts secrets and shortens the home folder', () => {
    const line = formatMainLogLine(
      'warn',
      [
        '[gh] failed in %s with',
        '/Users/someone/code/app',
        'ghp_abcdefghijklmnopqrstuvwxyz0123456789'
      ],
      options
    )
    expect(line).toBe(
      '2026-11-12T10:00:00.000Z WARN [gh] failed in ~/code/app with [redacted:github-token]\n'
    )
  })

  it('keeps an error stack but bounds one runaway line', () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at run (/Users/someone/app/main.js:1:1)'
    expect(formatMainLogLine('error', [error], options)).toContain('at run (~/app/main.js:1:1)')
    const long = formatMainLogLine('log', ['x'.repeat(40_000)], options)
    expect(long.length).toBeLessThan(16_500)
    expect(long.endsWith('… [truncated]\n')).toBe(true)
  })
})
