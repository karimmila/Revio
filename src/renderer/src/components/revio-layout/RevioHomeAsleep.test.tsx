// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AsleepCloudWorkspace } from '../../../../shared/asleep-cloud-workspace-types'

const mocks = vi.hoisted(
  (): {
    records: AsleepCloudWorkspace[]
    wake: (record: AsleepCloudWorkspace) => void
    openCloudSettings: (page: string) => void
  } => ({ records: [], wake: vi.fn(), openCloudSettings: vi.fn() })
)

vi.mock('@/lib/asleep-cloud-workspaces', () => ({
  useAsleepCloudWorkspaces: () => mocks.records
}))
vi.mock('@/lib/asleep-cloud-wake', () => ({ wakeAsleepCloudWorkspace: mocks.wake }))
vi.mock('./RevioLocationSwitcher', () => ({ openCloudSettings: mocks.openCloudSettings }))
vi.mock('./RevioWorkspaceHoverCard', () => ({ formatRevioAgo: () => '1d' }))

import {
  dismissAsleepCloudConnectNotice,
  showAsleepCloudConnectNotice
} from '@/lib/asleep-cloud-connect-notice'
import { RevioHomeAsleepRows, RevioHomeConnectCard, useHomeAsleepCloud } from './RevioHomeAsleep'

const record = (id: string, displayName: string, repoId = 'repo-1'): AsleepCloudWorkspace => ({
  id,
  repoId,
  displayName,
  branch: `me/${id}`,
  commit: 'a'.repeat(40),
  chats: [],
  lastActivityAt: '2026-11-11T10:00:00.000Z'
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.records = [
    record('billing', 'Refactor billing webhooks'),
    record('search', 'Speed up search')
  ]
  dismissAsleepCloudConnectNotice()
})
afterEach(cleanup)

it('lists the imported cloud workspaces on the Cloud Home only, and filters them', () => {
  expect(renderHook(() => useHomeAsleepCloud(true, '', 'all')).result.current).toHaveLength(2)
  expect(renderHook(() => useHomeAsleepCloud(false, '', 'all')).result.current).toHaveLength(0)
  expect(
    renderHook(() => useHomeAsleepCloud(true, 'billing', 'all')).result.current.map((r) => r.id)
  ).toEqual(['billing'])
  expect(renderHook(() => useHomeAsleepCloud(true, '', 'other-repo')).result.current).toEqual([])
})

it('opens a row by waking its workspace', () => {
  render(
    <RevioHomeAsleepRows
      records={mocks.records}
      repoNames={new Map([['repo-1', 'acme-web']])}
      showRepo
    />
  )
  fireEvent.click(screen.getByText('Refactor billing webhooks'))
  expect(mocks.wake).toHaveBeenCalledWith(mocks.records[0])
  expect(screen.getAllByText('acme-web')).toHaveLength(2)
})

it('shows the Connect Vercel card for a workspace that could not open, with the way to Cloud settings', () => {
  render(<RevioHomeConnectCard />)
  expect(screen.queryByRole('status')).toBeNull()
  act(() => showAsleepCloudConnectNotice(mocks.records[1]))
  expect(screen.getByText('Connect Vercel to open this imported cloud workspace')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('Speed up search')
  expect(screen.getByRole('status').textContent).toContain('stay saved on this Mac')
  fireEvent.click(screen.getByRole('button', { name: 'Connect Vercel' }))
  expect(mocks.openCloudSettings).toHaveBeenCalledWith('cloud')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByRole('status')).toBeNull()
})
