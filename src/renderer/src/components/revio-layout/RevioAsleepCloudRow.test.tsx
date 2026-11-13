// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RevioAsleepCloudRow } from './RevioAsleepCloudRow'

const wake = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/lib/asleep-cloud-wake', () => ({ wakeAsleepCloudWorkspace: wake }))

const NOW = Date.parse('2026-11-12T12:00:00Z')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('looks like an asleep cloud workspace and wakes it when opened', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  const record = {
    id: 'imp-1',
    repoId: 'repo-1',
    displayName: 'Cloud feature',
    branch: 'me/feature',
    commit: 'a'.repeat(40),
    chats: [],
    lastActivityAt: new Date(NOW - 2 * 3_600_000).toISOString()
  }
  render(<RevioAsleepCloudRow record={record} />)
  expect(screen.getByText('Cloud feature')).toBeTruthy()
  expect(screen.getByLabelText('Cloud workspace')).toBeTruthy()
  expect(screen.getByText('2h')).toBeTruthy()
  fireEvent.click(screen.getByRole('button'))
  expect(wake).toHaveBeenCalledWith(record)
})
