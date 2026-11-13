import { expect, it } from 'vitest'
import { restartRetiresChild } from './structured-agent-session-outgrown-child'

it('/restart retires a running child, and only when asked', () => {
  const child = { generation: null, fence: 1, phase: 'ready' as const }
  expect(restartRetiresChild(() => true, child)).toBe(true)
  expect(restartRetiresChild(() => false, child)).toBe(false)
  expect(restartRetiresChild(undefined, child)).toBe(false)
  expect(restartRetiresChild(() => true, null)).toBe(false)
})
