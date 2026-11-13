// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { applyRevioLoadout, revioLoadoutSlot } from './apply-revio-loadout'

const launch = vi.hoisted(() => vi.fn(() => true))
vi.mock('../launch-revio-chat', () => ({ launchRevioAgentChat: launch }))
const surface = vi.hoisted(() => ({ setOption: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/components/native-chat/native-chat-composer-surface-registry', () => ({
  composerSurfaceFor: () => ({
    surface,
    snapshot: () => [
      {
        id: 'model',
        category: 'model',
        kind: {
          type: 'select',
          currentValue: 'sonnet',
          choices: [{ value: 'sonnet' }, { value: 'opus' }]
        }
      }
    ]
  })
}))

afterEach(() => vi.clearAllMocks())

const loadout = { id: '1', agent: 'claude', model: 'opus', effort: 'high', label: 'Opus · High' }

it('sets model then effort on a chat that offers the model', async () => {
  await applyRevioLoadout(loadout, document.createElement('div'))
  expect(surface.setOption.mock.calls).toEqual([
    ['model', 'opus'],
    ['effort', 'high']
  ])
  expect(launch).not.toHaveBeenCalled()
})

it("opens a new chat for another agent's loadout", async () => {
  useAppStore.setState({ activeWorktreeId: 'r::/w' })
  await applyRevioLoadout(
    { ...loadout, agent: 'codex', model: 'gpt-5' },
    document.createElement('div')
  )
  expect(launch).toHaveBeenCalledWith('r::/w', { agent: 'codex', model: 'gpt-5' })
})

it('reads ⌘⌃1…5', () => {
  const key = (code: string, init: KeyboardEventInit = {}) =>
    new KeyboardEvent('keydown', { code, metaKey: true, ctrlKey: true, ...init })
  expect(revioLoadoutSlot(key('Digit3'))).toBe(3)
  expect(revioLoadoutSlot(key('Digit6'))).toBeNull()
  expect(revioLoadoutSlot(key('Digit1', { ctrlKey: false }))).toBeNull()
})
