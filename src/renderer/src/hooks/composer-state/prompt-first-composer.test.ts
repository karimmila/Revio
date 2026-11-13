import { describe, expect, it, vi } from 'vitest'

vi.mock('@/runtime/agent-launch-settings/use-host-agent-launch-preferences', () => ({
  ensureAgentLaunchPreferences: vi.fn()
}))

const { withTypedPrompt } = await import('./quick-startup-plan')
const { promptNameSeed } = await import('./quick-submit-action')

describe('withTypedPrompt', () => {
  it('keeps the linked-item resolution when nothing was typed', () => {
    const resolved = { prompt: '', draftPrompt: 'https://github.com/o/r/issues/1' }
    expect(withTypedPrompt(resolved, '   ')).toBe(resolved)
    expect(withTypedPrompt(resolved, undefined)).toBe(resolved)
  })

  it('auto-submits the typed prompt with linked context beneath it', () => {
    expect(
      withTypedPrompt({ prompt: '', draftPrompt: 'https://github.com/o/r/issues/1' }, ' Fix it ')
    ).toEqual({ prompt: 'Fix it\n\nhttps://github.com/o/r/issues/1', draftPrompt: null })
  })

  it('sends the typed prompt alone when there is no linked item', () => {
    expect(withTypedPrompt({ prompt: '', draftPrompt: null }, 'Add tests')).toEqual({
      prompt: 'Add tests',
      draftPrompt: null
    })
  })
})

describe('promptNameSeed', () => {
  it('uses the first sentence, at most five words, without punctuation', () => {
    expect(promptNameSeed('Fix the README title typo. Then reply.')).toBe(
      'Fix the README title typo'
    )
    expect(promptNameSeed('why is /api/calls slow?')).toBe('why is api calls slow')
  })

  it('is empty for an empty prompt so the creature-name fallback applies', () => {
    expect(promptNameSeed(undefined)).toBe('')
    expect(promptNameSeed('  ')).toBe('')
  })
})
