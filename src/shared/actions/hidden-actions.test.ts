import { expect, it } from 'vitest'
import { isActionHidden, toggleHiddenAction } from './hidden-actions'

it('hides and shows one action of one repository', () => {
  const hidden = toggleHiddenAction(undefined, 'r1', 'shared:0:dev')
  expect(isActionHidden(hidden, 'r1', 'shared:0:dev')).toBe(true)
  expect(isActionHidden(hidden, 'r2', 'shared:0:dev')).toBe(false)
  expect(
    isActionHidden(toggleHiddenAction(hidden, 'r1', 'shared:0:dev'), 'r1', 'shared:0:dev')
  ).toBe(false)
})
