import { expect, it } from 'vitest'
import { differsOnlyInWhitespace } from './diff-whitespace-only'

it('spots changes made only of indentation or trailing spaces', () => {
  expect(differsOnlyInWhitespace('a\n  b\n', 'a\n    b  \n')).toBe(true)
  expect(differsOnlyInWhitespace('a\r\nb', 'a\nb ')).toBe(true)
})

it('is false for real edits, added lines or identical text', () => {
  expect(differsOnlyInWhitespace('a\nb', 'a\nc')).toBe(false)
  expect(differsOnlyInWhitespace('a\nb', 'a\nb\n\n')).toBe(false)
  expect(differsOnlyInWhitespace('a', 'a')).toBe(false)
})
