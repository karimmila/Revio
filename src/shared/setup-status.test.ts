import { expect, it } from 'vitest'
import { parseSetupStatus } from './setup-status'

it('reads the runner status file', () => {
  expect(parseSetupStatus('running')).toBe('running')
  expect(parseSetupStatus('0')).toBe('succeeded')
  expect(parseSetupStatus('1\n')).toBe('failed')
  expect(parseSetupStatus('')).toBeNull()
  expect(parseSetupStatus(null)).toBeNull()
  expect(parseSetupStatus('garbage')).toBeNull()
})
