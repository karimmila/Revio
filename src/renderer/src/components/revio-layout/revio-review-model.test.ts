import { describe, expect, it } from 'vitest'
import { parseRevioReviewModel } from './revio-review-model'

describe('parseRevioReviewModel', () => {
  it('reads agent and model', () => {
    expect(parseRevioReviewModel('codex:gpt-5.5')).toEqual({ agent: 'codex', model: 'gpt-5.5' })
    expect(parseRevioReviewModel('claude:claude-opus-4-1:thinking')).toEqual({
      agent: 'claude',
      model: 'claude-opus-4-1:thinking'
    })
  })

  it('falls back to the defaults for empty or unknown values', () => {
    expect(parseRevioReviewModel(undefined)).toBeNull()
    expect(parseRevioReviewModel('')).toBeNull()
    expect(parseRevioReviewModel('claude:')).toBeNull()
    expect(parseRevioReviewModel('not-an-agent:x')).toBeNull()
  })
})
