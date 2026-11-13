import { expect, it } from 'vitest'
import { revioTabLimit, revioTabLimitReached } from './revio-tab-limit'

it('caps only with Split tabs off: 5, or 10 with Tab Freak Mode', () => {
  expect(revioTabLimit({})).toBeNull()
  expect(revioTabLimit({ revioSplitTabs: false })).toBe(5)
  expect(revioTabLimit({ revioSplitTabs: false, revioTabFreakMode: true })).toBe(10)
})

it('counts chat and terminal tabs, not browsers or files', () => {
  const tabs = [
    ...Array.from({ length: 4 }, () => ({ contentType: 'agent-session' as const })),
    { contentType: 'browser' as const },
    { contentType: 'editor' as const }
  ]
  expect(revioTabLimitReached(tabs, 5)).toBe(false)
  expect(revioTabLimitReached([...tabs, { contentType: 'terminal' as const }], 5)).toBe(true)
  expect(revioTabLimitReached(tabs, null)).toBe(false)
})
