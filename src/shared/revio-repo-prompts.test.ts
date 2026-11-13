import { describe, expect, it } from 'vitest'
import { mergeRevioPrompts } from './revio-repo-prompts'

describe('mergeRevioPrompts', () => {
  it('lets a repository override some prompts and keep the rest global', () => {
    expect(
      mergeRevioPrompts(
        { review: 'global review', createPr: 'global pr' },
        { review: 'repo review', createPr: '  ' }
      )
    ).toEqual({ review: 'repo review', createPr: 'global pr' })
    expect(mergeRevioPrompts(undefined, undefined)).toEqual({})
  })
})

describe('withRepoGeneralPreferences', () => {
  it('sets trimmed text for one repository and removes it when blank', async () => {
    const { withRepoGeneralPreferences } = await import('./revio-repo-prompts')
    expect(withRepoGeneralPreferences({ r2: 'Two.' }, 'r1', ' One. ')).toEqual({
      r1: 'One.',
      r2: 'Two.'
    })
    expect(withRepoGeneralPreferences({ r1: 'One.', r2: 'Two.' }, 'r1', '  ')).toEqual({
      r2: 'Two.'
    })
    expect(withRepoGeneralPreferences(undefined, 'r1', '')).toEqual({})
  })
})
