import { beforeEach, describe, expect, it, vi } from 'vitest'

type Loadout = { id: string; agent: string; model: string; label: string }

const mocks = vi.hoisted(() => ({
  state: {
    settings: {
      revioLoadouts: new Array<Loadout>()
    },
    updateSettings: vi.fn()
  },
  success: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn()
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('../revio-terminal-link-confirm', () => ({ confirmWithAppDialog: mocks.confirm }))

import { equipSharedLoadout } from './equip-shared-loadout'

describe('equipSharedLoadout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.settings.revioLoadouts = []
    mocks.confirm.mockResolvedValue(true)
  })

  it('shows what the link saves and saves nothing when the person says no', async () => {
    mocks.confirm.mockResolvedValue(false)
    await equipSharedLoadout({ agent: 'codex', model: 'gpt-x', effort: 'high', label: 'Fast' })
    const [asked] = mocks.confirm.mock.calls[0]
    for (const shown of ['Fast', 'codex', 'gpt-x', 'high']) {
      expect(asked.description).toContain(shown)
    }
    expect(mocks.state.updateSettings).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('saves the shared loadout and says it is equipped', async () => {
    await equipSharedLoadout({ agent: 'claude', model: 'opus', label: 'Opus' })
    expect(mocks.state.updateSettings).toHaveBeenCalledWith({
      revioLoadouts: [expect.objectContaining({ agent: 'claude', model: 'opus' })]
    })
    expect(mocks.success).toHaveBeenCalled()
  })

  it('refuses a sixth loadout', async () => {
    mocks.state.settings.revioLoadouts = Array.from({ length: 5 }, (_, i) => ({
      id: `l${i}`,
      agent: 'claude',
      model: `m${i}`,
      label: `m${i}`
    }))
    await equipSharedLoadout({ agent: 'claude', model: 'opus', label: 'Opus' })
    expect(mocks.state.updateSettings).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalled()
  })
})
