import { describe, expect, it } from 'vitest'
import { conflictReplacement } from './monaco-conflict-actions'

const content = [
  'top',
  '<<<<<<< HEAD',
  'mine',
  '=======',
  'theirs',
  '>>>>>>> feature',
  'bottom'
].join('\n')

describe('conflictReplacement', () => {
  it('keeps the current side', () => {
    expect(conflictReplacement(content, 0, 'current')).toEqual({
      startLine: 2,
      endLine: 6,
      text: 'mine'
    })
  })

  it('keeps the incoming side', () => {
    expect(conflictReplacement(content, 0, 'incoming')?.text).toBe('theirs')
  })

  it('keeps both, current first', () => {
    expect(conflictReplacement(content, 0, 'both')?.text).toBe('mine\ntheirs')
  })

  it('drops the common ancestor of a diff3 conflict', () => {
    const diff3 = '<<<<<<< a\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> b'
    expect(conflictReplacement(diff3, 0, 'both')?.text).toBe('mine\ntheirs')
  })

  it('returns null for a missing block', () => {
    expect(conflictReplacement(content, 1, 'current')).toBeNull()
  })
})
