import { expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: Object.assign(() => null, { getState: () => ({}) }) }))

const { agentStateLabel } = await import('./RevioWorkspaceRow')

it('says the agent waits on background tasks once only they are running', () => {
  expect(agentStateLabel('monitoring', null, false, null)).toBe('Waiting for background tasks')
  expect(agentStateLabel('working', null, false, null)).toBe('Working…')
  expect(agentStateLabel('done', null, false, null)).toBeNull()
})
