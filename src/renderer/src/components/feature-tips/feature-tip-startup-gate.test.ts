import { describe, expect, it } from 'vitest'
import { FEATURE_TIP_IDS, type FeatureTipId } from '../../../../shared/feature-tips'
import { getDefaultOnboardingState } from '../../../../shared/onboarding-defaults'
import {
  getFeatureTipsAppOpenDecision,
  type FeatureTipSettings,
  type FeatureTipsAppOpenDecision
} from './feature-tip-startup-gate'

const closedOnboarding = {
  ...getDefaultOnboardingState(),
  closedAt: 1,
  outcome: 'completed' as const
}

/** One decision per launch, each launch remembering the tips the earlier ones showed. */
function decisionsOverLaunches(
  settings: FeatureTipSettings,
  launches: number
): FeatureTipsAppOpenDecision[] {
  const seen: FeatureTipId[] = []
  const decisions: FeatureTipsAppOpenDecision[] = []
  for (let launch = 1; launch <= launches; launch += 1) {
    const decision = getFeatureTipsAppOpenDecision({
      activeModal: 'none',
      cliInstalled: false,
      featureTipsSeenIds: seen,
      featureInteractions: {},
      chatUiLaunchTipVariant: 'chat-ui-on',
      onboarding: closedOnboarding,
      persistedUIReady: true,
      promptedThisSession: false,
      settings,
      suppressedByOnboardingThisSession: false,
      webClient: false
    })
    decisions.push(decision)
    if (decision.kind === 'open') {
      seen.push(decision.tipId)
    }
  }
  return decisions
}

describe('feature tips at launch', () => {
  it('schedules no announcement on launches 1 to 10 in the workspace layout', () => {
    const decisions = decisionsOverLaunches({ revioLayout: true }, 10)
    expect(decisions).toEqual(Array.from({ length: 10 }, () => ({ kind: 'skip' })))
  })

  it('still walks through every tip, one per launch, in the classic layout', () => {
    const decisions = decisionsOverLaunches({ revioLayout: false }, 10)
    const opened = decisions.flatMap((decision) =>
      decision.kind === 'open' ? [decision.tipId] : []
    )
    expect([...opened].sort()).toEqual([...FEATURE_TIP_IDS].sort())
    expect(decisions.slice(FEATURE_TIP_IDS.length).every((d) => d.kind === 'skip')).toBe(true)
  })
})
