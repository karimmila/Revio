import { expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('./revio-dock-terminals', () => ({ runInRevioDock: vi.fn() }))

import { spotlightScript } from './revio-spotlight'

it("writes the workspace's tree into the root without moving the root's HEAD", () => {
  const script = spotlightScript('/repo', "/ws/it's")
  expect(script).toContain(`git -C '/ws/it'\\''s' add -A`)
  expect(script).toContain(`git -C '/repo' read-tree -u --reset "$tree"`)
  expect(script).toContain(`git -C '/repo' read-tree HEAD`)
  expect(script).not.toMatch(/git -C '\/repo' (reset|checkout|commit)/)
  expect(script).toContain('rebase-merge')
})
