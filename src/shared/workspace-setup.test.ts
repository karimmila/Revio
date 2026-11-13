import { describe, expect, it } from 'vitest'
import { sanitizeWorkspaceSetupProgress } from './workspace-setup'

describe('sanitizeWorkspaceSetupProgress', () => {
  it('keeps a valid record and drops unknown or repeated step ids', () => {
    expect(
      sanitizeWorkspaceSetupProgress({
        lastCompletedStep: 2,
        skipped: ['cloud', 'cloud', 'nope', 7]
      })
    ).toEqual({ lastCompletedStep: 2, skipped: ['cloud'] })
  })

  it('refuses out-of-range or non-integer steps', () => {
    expect(sanitizeWorkspaceSetupProgress({ lastCompletedStep: 5, skipped: [] })).toBeNull()
    expect(sanitizeWorkspaceSetupProgress({ lastCompletedStep: -2, skipped: [] })).toBeNull()
    expect(sanitizeWorkspaceSetupProgress({ lastCompletedStep: 1.5 })).toBeNull()
    expect(sanitizeWorkspaceSetupProgress(null)).toBeNull()
  })
})
