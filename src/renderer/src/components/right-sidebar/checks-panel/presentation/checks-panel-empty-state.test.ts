import { describe, expect, it } from 'vitest'
import {
  getChecksPanelReviewState,
  shouldShowChecksPanelPublishBranchAction
} from './checks-panel-empty-state'
import type { ChecksPanelReviewStateInput } from '../checks-panel-review-state-model'

function input(overrides: Partial<ChecksPanelReviewStateInput> = {}): ChecksPanelReviewStateInput {
  return {
    operationLabel: null,
    reviewLabel: 'pull request',
    reviewShortLabel: 'PR',
    providerName: 'GitHub',
    isGitHubProvider: true,
    reviewLookup: 'unknown',
    openReviewUrl: null,
    eligibilityBlockedReason: undefined,
    confirmedReadiness: false,
    confirmedNeedsPush: false,
    refresh: undefined,
    gitStatusPhase: 'ready',
    hasUpstream: true,
    hasCurrentBranch: true,
    ...overrides
  }
}

describe('getChecksPanelReviewState — precedence', () => {
  it('positive_unresolved blocks create and offers Open Review', () => {
    const state = getChecksPanelReviewState(
      input({ reviewLookup: 'positive_unresolved', openReviewUrl: 'https://x/pull/1' })
    )
    expect(state.title).toBe('Pull request details unavailable')
    expect(state.composerMode).toBe('hidden')
    expect(state.workflowAction).toBeNull()
    expect(state.recovery).toContain('open_review')
    expect(state.openReviewUrl).toBe('https://x/pull/1')
  })

  it('offers Open Review under a branch blocker when positive evidence has a trusted URL', () => {
    // Branch guidance must preserve known Open Review while suppressing create actions.
    const state = getChecksPanelReviewState(
      input({
        reviewLookup: 'positive_unresolved',
        openReviewUrl: 'https://x/pull/7',
        eligibilityBlockedReason: 'no_upstream',
        hasUpstream: false
      })
    )
    expect(state.title).toBe('No upstream configured')
    expect(state.workflowAction).toBe('publish_branch')
    expect(state.composerMode).toBe('hidden')
    expect(state.recovery).toContain('open_review')
    expect(state.openReviewUrl).toBe('https://x/pull/7')
  })

  it('hard refresh error hides the composer', () => {
    const state = getChecksPanelReviewState(
      input({ refresh: { status: 'error', errorType: 'auth' } })
    )
    expect(state.title).toBe('GitHub authentication failed')
    expect(state.composerMode).toBe('hidden')
    expect(state.workflowAction).toBeNull()
  })
})

describe('getChecksPanelReviewState — composer preserve', () => {
  it('transient error preserves a confirmed composer', () => {
    const state = getChecksPanelReviewState(
      input({ confirmedReadiness: true, refresh: { status: 'error', errorType: 'network' } })
    )
    expect(state.composerMode).toBe('confirmed_open')
    expect(state.title).toBe('Could not reach GitHub')
  })

  it('transient error without confirmed readiness never opens a composer', () => {
    const state = getChecksPanelReviewState(
      input({ confirmedReadiness: false, refresh: { status: 'error', errorType: 'network' } })
    )
    expect(state.composerMode).toBe('hidden')
  })

  it('needs_push with positive_unresolved never exposes Push & Create', () => {
    const state = getChecksPanelReviewState(
      input({
        eligibilityBlockedReason: 'needs_push',
        reviewLookup: 'positive_unresolved',
        confirmedReadiness: true,
        confirmedNeedsPush: true
      })
    )
    expect(state.composerMode).toBe('hidden')
    expect(state.workflowAction).toBeNull()
  })

  it('needs_push with confirmed readiness offers Push & Create', () => {
    const state = getChecksPanelReviewState(
      input({
        eligibilityBlockedReason: 'needs_push',
        reviewLookup: 'not_found',
        confirmedReadiness: true,
        confirmedNeedsPush: true
      })
    )
    expect(state.composerMode).toBe('needs_push_open')
    expect(state.workflowAction).toBe('push_and_create')
  })
})

describe('getChecksPanelReviewState — a repository GitHub cannot reach', () => {
  it('asks to install the app before any publish or push step', () => {
    for (const eligibilityBlockedReason of ['no_upstream', 'needs_push'] as const) {
      const state = getChecksPanelReviewState(
        input({
          eligibilityBlockedReason,
          hasUpstream: eligibilityBlockedReason === 'needs_push',
          refresh: { status: 'error', errorType: 'app_not_installed', installOwner: 'acme' }
        })
      )
      expect(state.title).toContain('on acme')
      expect(state.recovery).toEqual(['install_app', 'retry'])
      expect(state.workflowAction).toBeNull()
      expect(state.composerMode).toBe('hidden')
    }
  })

  it('asks to sign in with GitHub before a publish step', () => {
    const state = getChecksPanelReviewState(
      input({
        eligibilityBlockedReason: 'no_upstream',
        hasUpstream: false,
        refresh: { status: 'error', errorType: 'github_sign_in' }
      })
    )
    expect(state.title).toBe('Sign in with GitHub')
    expect(state.recovery).toEqual(['github_sign_in'])
  })

  it('says a project with no remote has no GitHub remote, not an unsupported provider', () => {
    const state = getChecksPanelReviewState(
      input({
        eligibilityBlockedReason: 'unsupported_provider',
        hasUpstream: false,
        noRemote: true
      })
    )
    expect(state.title).toBe('No GitHub remote')
    expect(state.description).toBe(
      'This project has no GitHub remote. Add one to publish branches and open pull requests.'
    )
    expect(state.workflowAction).toBeNull()
  })

  it('offers no Publish Branch when a push could only fail', () => {
    const publish = { hostedReviewBlockedReason: undefined, hasUpstream: false }
    expect(shouldShowChecksPanelPublishBranchAction(publish)).toBe(true)
    expect(shouldShowChecksPanelPublishBranchAction({ ...publish, cannotReachRemote: true })).toBe(
      false
    )
  })
})
