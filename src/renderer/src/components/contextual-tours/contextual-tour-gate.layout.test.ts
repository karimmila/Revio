import { describe, expect, it } from 'vitest'
import { getContextualTour } from '../../../../shared/contextual-tours'
import { getContextualTourRequestDecision } from './contextual-tour-gate'

function decide(revioLayout: boolean) {
  return getContextualTourRequestDecision({
    tour: getContextualTour('floating-workspace'),
    persistedUIReady: true,
    autoEligible: true,
    onboardingVisible: false,
    seenIds: [],
    progressBlocked: false,
    sessionConsumed: false,
    activeTourId: null,
    activeModal: 'none',
    blockingSurfaceVisible: false,
    targetExists: () => true,
    revioLayout
  })
}

describe('contextual tours by layout', () => {
  it('never starts a tour in the workspace layout, even a forced one', () => {
    expect(decide(true)).toEqual({ kind: 'blocked', reason: 'workspace-layout' })
  })

  it('starts the tour in the classic layout', () => {
    expect(decide(false)).toEqual({ kind: 'start', stepIndex: 0 })
  })
})
