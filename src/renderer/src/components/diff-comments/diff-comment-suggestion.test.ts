import { describe, expect, it } from 'vitest'
import { splitDiffCommentSuggestions } from './diff-comment-suggestion'

describe('splitDiffCommentSuggestions', () => {
  it('keeps a plain note as one text part', () => {
    expect(splitDiffCommentSuggestions('Rename this')).toEqual([
      { kind: 'text', offset: 0, text: 'Rename this' }
    ])
  })

  it('splits a suggestion block out of the prose', () => {
    const body = 'Use const:\n```suggestion\nconst a = 1\nconst b = 2\n```\nThanks'
    expect(splitDiffCommentSuggestions(body)).toEqual([
      { kind: 'text', offset: 0, text: 'Use const:' },
      { kind: 'suggestion', offset: 11, lines: ['const a = 1', 'const b = 2'] },
      { kind: 'text', offset: body.indexOf('\nThanks'), text: 'Thanks' }
    ])
  })

  it('treats an empty suggestion as deleting the lines', () => {
    expect(splitDiffCommentSuggestions('```suggestion\n```')).toEqual([
      { kind: 'suggestion', offset: 0, lines: [] }
    ])
  })
})
