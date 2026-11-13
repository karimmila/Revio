import { expect, it } from 'vitest'
import { stripAbsolutelyRight } from './native-chat-absolutely-right'

it('drops only the opener', () => {
  expect(stripAbsolutelyRight("You're absolutely right! the test fails.")).toBe('The test fails.')
  expect(stripAbsolutelyRight('You’re absolutely right - fixed.')).toBe('Fixed.')
  expect(stripAbsolutelyRight('You are right.')).toBe('You are right.')
  expect(stripAbsolutelyRight("I think you're absolutely right.")).toBe(
    "I think you're absolutely right."
  )
})
