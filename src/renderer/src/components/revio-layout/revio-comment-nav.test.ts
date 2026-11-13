import { describe, expect, it } from 'vitest'
import { commentsOutOfView, pickComment } from './revio-comment-nav'

describe('pickComment', () => {
  const lines = [10, 40, 90]

  it('goes to the first comment past the current line', () => {
    expect(pickComment(lines, 1, 'next', 0)).toBe(0)
    expect(pickComment(lines, 10, 'next', 0)).toBe(1)
  })

  it('goes back to the last comment before the current line', () => {
    expect(pickComment(lines, 90, 'previous', 0)).toBe(1)
    expect(pickComment(lines, 100, 'previous', 0)).toBe(2)
  })

  it('stops at either end', () => {
    expect(pickComment(lines, 90, 'next', 0)).toBeNull()
    expect(pickComment(lines, 10, 'previous', 0)).toBeNull()
    expect(pickComment([], 5, 'next')).toBeNull()
  })

  it('skips the comment already centred within the slack', () => {
    expect(pickComment([100, 300], 102, 'next', 4)).toBe(1)
    expect(pickComment([100, 300], 298, 'previous', 4)).toBe(0)
  })
})

describe('commentsOutOfView', () => {
  function box(top: number, height: number) {
    return { getBoundingClientRect: () => ({ top, bottom: top + height, height }) }
  }

  it('counts cards above and below the visible diff', () => {
    const cards = [box(-200, 40), box(50, 40), box(900, 40), box(1200, 40), box(1300, 0)]
    const viewport = {
      ...box(0, 800),
      querySelectorAll: () => cards
    }
    expect(commentsOutOfView(viewport)).toEqual({ previous: 1, next: 2 })
  })
})
