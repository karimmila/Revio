import { describe, expect, it } from 'vitest'
import type { GitHubPRMergeMethodSettings } from './pull-request-types'
import {
  revioMergeMethod,
  normalizeGitHubPRMergeMethodSettings,
  resolveGitHubPRMergeMethods
} from './pull-request-merge-methods'

describe('GitHub PR merge methods', () => {
  it('keeps the historical squash-first fallback when repository metadata is missing', () => {
    expect(resolveGitHubPRMergeMethods()).toEqual({
      defaultMethod: 'squash',
      methods: ['squash', 'merge', 'rebase']
    })
  })

  it('uses GitHub viewer defaults and hides methods disabled by the repository', () => {
    const settings = normalizeGitHubPRMergeMethodSettings({
      defaultMethod: 'REBASE',
      mergeCommitAllowed: false,
      rebaseMergeAllowed: true,
      squashMergeAllowed: true
    })

    expect(resolveGitHubPRMergeMethods(settings)).toEqual({
      defaultMethod: 'rebase',
      methods: ['rebase', 'squash']
    })
  })

  it('falls back to an allowed method when GitHub returns a disabled default', () => {
    const settings = normalizeGitHubPRMergeMethodSettings({
      defaultMethod: 'SQUASH',
      mergeCommitAllowed: true,
      rebaseMergeAllowed: false,
      squashMergeAllowed: false
    })

    expect(settings?.defaultMethod).toBe('merge')
    expect(resolveGitHubPRMergeMethods(settings).methods).toEqual(['merge'])
  })
})

describe('revioMergeMethod', () => {
  const allowed = (
    squash: boolean,
    merge: boolean,
    rebase: boolean
  ): GitHubPRMergeMethodSettings => ({
    defaultMethod: 'merge',
    allowedMethods: { squash, merge, rebase }
  })

  it('takes squash, then rebase, then merge, ignoring the default', () => {
    expect(revioMergeMethod(allowed(true, true, true))).toBe('squash')
    expect(revioMergeMethod(allowed(false, true, true))).toBe('rebase')
    expect(revioMergeMethod(allowed(false, true, false))).toBe('merge')
    expect(revioMergeMethod(null)).toBe('squash')
  })
})
