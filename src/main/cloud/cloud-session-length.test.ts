import { expect, it, vi } from 'vitest'
import { CREATE_TIMEOUT_MS, extendToPlanLimit } from './cloud-session-length'

it('extends a Pro session past the 45 minutes Vercel takes at create', async () => {
  const extendTimeout = vi.fn(async () => {})
  expect(await extendToPlanLimit({ extendTimeout }, { maxSessionMinutes: 24 * 60 })).toBe(
    24 * 3_600_000
  )
  expect(extendTimeout).toHaveBeenCalledWith(24 * 3_600_000 - CREATE_TIMEOUT_MS)
})

it('falls back to five hours when the plan figure is refused, then keeps 45 minutes', async () => {
  const extendTimeout = vi.fn(async (ms: number) => {
    if (ms > 5 * 3_600_000 - CREATE_TIMEOUT_MS) {
      throw new Error('over the plan limit')
    }
  })
  expect(await extendToPlanLimit({ extendTimeout }, { maxSessionMinutes: 24 * 60 })).toBe(
    5 * 3_600_000
  )
  const refused = vi.fn(async () => {
    throw new Error('no')
  })
  expect(await extendToPlanLimit({ extendTimeout: refused }, { maxSessionMinutes: 24 * 60 })).toBe(
    CREATE_TIMEOUT_MS
  )
})

it('leaves a Hobby session at 45 minutes', async () => {
  const extendTimeout = vi.fn()
  expect(await extendToPlanLimit({ extendTimeout }, { maxSessionMinutes: 45 })).toBe(
    CREATE_TIMEOUT_MS
  )
  expect(extendTimeout).not.toHaveBeenCalled()
})
