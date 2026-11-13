import { beforeEach, expect, it } from 'vitest'
import { applySetupStatuses, resetSetupStatusesForTest, setupStatusOf } from './revio-setup-status'

beforeEach(() => resetSetupStatusesForTest())

it('keeps the latest status main pushed for each worktree', () => {
  applySetupStatuses({ '/a': 'running', '/b': null })
  applySetupStatuses({ '/a': 'succeeded' })
  expect(setupStatusOf('/a')).toBe('succeeded')
  expect(setupStatusOf('/b')).toBeNull()
  expect(setupStatusOf('/unknown')).toBeNull()
})
