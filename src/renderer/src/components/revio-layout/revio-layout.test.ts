import { describe, expect, it } from 'vitest'
import { formatCompactCount } from './revio-layout'

describe('formatCompactCount', () => {
  it('keeps small counts exact and shortens thousands rows', () => {
    expect(formatCompactCount(44)).toBe('44')
    expect(formatCompactCount(999)).toBe('999')
    expect(formatCompactCount(3234)).toBe('3.2k')
    expect(formatCompactCount(12500)).toBe('13k')
  })
})
