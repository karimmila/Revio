import { describe, expect, it, vi } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))
vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))

import { fetchNudge } from './nudges/nudge-campaign'
import { fetchChangelog } from './releases/updater-changelog'

// fork-identity.json ships whatsNewUrl as null, so neither feed may reach the network.
describe("what's new without a fork feed", () => {
  it('fetches no changelog and no nudge', async () => {
    await expect(fetchChangelog('2.0.0', '1.0.0')).resolves.toBeNull()
    await expect(fetchNudge()).resolves.toBeNull()
    expect(netFetchMock).not.toHaveBeenCalled()
  })
})
