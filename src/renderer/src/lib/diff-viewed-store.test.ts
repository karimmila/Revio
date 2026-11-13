// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { diffChangeSignature, isDiffFileViewed, toggleDiffFileViewed } from './diff-viewed-store'

it('marks a file viewed for its current change only, and toggles back', () => {
  const at = diffChangeSignature(3, 1)
  expect(toggleDiffFileViewed('w', 'a.ts', at)).toBe(true)
  expect(isDiffFileViewed('w', 'a.ts', at)).toBe(true)
  // A new change to the file is not viewed yet.
  expect(isDiffFileViewed('w', 'a.ts', diffChangeSignature(4, 1))).toBe(false)
  expect(isDiffFileViewed('other', 'a.ts', at)).toBe(false)
  expect(toggleDiffFileViewed('w', 'a.ts', at)).toBe(false)
  expect(isDiffFileViewed('w', 'a.ts', at)).toBe(false)
})
