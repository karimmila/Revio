import { describe, expect, it } from 'vitest'
import { filesToCopyText, withFilesToCopy } from './revio-files-to-copy'
import { parseFilesToCopy } from '../../../../../shared/worktree-include-preview'

describe('Files to copy', () => {
  it('shows .env* until the repository saves its own patterns', () => {
    expect(filesToCopyText(undefined, 'r')).toBe('.env*')
    expect(filesToCopyText({ r: ['.env', '*.local'] }, 'r')).toBe('.env\n*.local')
  })

  it('reads one pattern per line, without blanks or comments', () => {
    expect(parseFilesToCopy(' .env \n\n# keys\nconfig/*.json\r\n')).toEqual([
      '.env',
      'config/*.json'
    ])
  })

  it('saves patterns per repository and drops the entry when back to the default', () => {
    const saved = withFilesToCopy({ other: ['x'] }, 'r', '.env\n*.local')
    expect(saved).toEqual({ other: ['x'], r: ['.env', '*.local'] })
    expect(withFilesToCopy(saved, 'r', '.env*\n')).toEqual({ other: ['x'] })
  })

  it('keeps an empty list, which copies nothing', () => {
    expect(withFilesToCopy(undefined, 'r', '')).toEqual({ r: [] })
  })
})
