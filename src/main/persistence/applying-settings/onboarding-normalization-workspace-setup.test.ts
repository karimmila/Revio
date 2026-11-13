import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingState } from '../../../shared/onboarding-defaults'
import {
  normalizeLoadedOnboardingState,
  sanitizeOnboardingUpdate
} from './onboarding-normalization'

describe('workspace setup progress persistence', () => {
  it('passes a valid workspaceSetup update through', () => {
    expect(
      sanitizeOnboardingUpdate({ workspaceSetup: { lastCompletedStep: 1, skipped: ['agent'] } })
    ).toEqual({ workspaceSetup: { lastCompletedStep: 1, skipped: ['agent'] } })
  })

  it('drops an invalid workspaceSetup update instead of overwriting saved progress', () => {
    expect(sanitizeOnboardingUpdate({ workspaceSetup: { lastCompletedStep: 'x' } })).toEqual({})
  })

  it('keeps workspaceSetup across a reload', () => {
    const saved = {
      ...getDefaultOnboardingState(),
      workspaceSetup: { lastCompletedStep: 3, skipped: ['cloud'] }
    }
    const loaded = normalizeLoadedOnboardingState(saved, getDefaultOnboardingState())
    expect(loaded.workspaceSetup).toEqual({ lastCompletedStep: 3, skipped: ['cloud'] })
    expect(loaded.closedAt).toBeNull()
  })
})
