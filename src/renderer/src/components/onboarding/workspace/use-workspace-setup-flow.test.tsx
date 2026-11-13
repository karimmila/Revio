// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../../shared/constants'
import { getDefaultOnboardingState } from '../../../../../shared/onboarding-defaults'
import type { OnboardingState } from '../../../../../shared/onboarding-state-types'
import { useWorkspaceSetupFlow } from './use-workspace-setup-flow'

const update = vi.fn(async (updates: Partial<OnboardingState>) => ({
  ...getDefaultOnboardingState(),
  ...updates
}))

function stubApi(options: { claudeToken?: boolean; vercel?: 'connected' | 'disconnected' }): void {
  const team = { id: 't', name: 'Team', slug: 'team', plan: 'pro' }
  vi.stubGlobal('api', {
    onboarding: { update },
    rateLimits: { get: vi.fn(async () => useAppStore.getState().rateLimits) },
    cloud: {
      claudeTokenSet: vi.fn(async () => options.claudeToken === true),
      githubStatus: vi.fn(async () => ({
        app: { configured: false, message: '' },
        account: null,
        signInExpired: false,
        signIn: null,
        repos: [],
        pendingInstallOwner: null,
        coverageError: null,
        migrated: false
      })),
      onGithubEvent: vi.fn(() => () => {})
    },
    vercelCloud: {
      status: vi.fn(async () =>
        options.vercel === 'connected'
          ? {
              state: 'connected',
              via: 'token',
              username: 'me',
              team,
              teams: [team],
              projectId: 'p',
              limits: { plan: 'pro', maxVcpus: 8, maxSessionMinutes: 60 }
            }
          : { state: 'disconnected' }
      )
    }
  })
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home'), revioLocation: 'cloud' },
    updateSettings: vi.fn(async () => {})
  })
  vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
  update.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useWorkspaceSetupFlow', () => {
  it('marks already-connected steps done and starts at the first open one', async () => {
    stubApi({ claudeToken: true, vercel: 'connected' })
    const { result } = renderHook(() =>
      useWorkspaceSetupFlow(getDefaultOnboardingState(), () => {})
    )
    await waitFor(() => expect(result.current.currentId).toBe('project'))
  })

  it('saves Set up later for an unconnected step', async () => {
    stubApi({})
    const { result } = renderHook(() =>
      useWorkspaceSetupFlow(getDefaultOnboardingState(), () => {})
    )
    await waitFor(() => expect(result.current.live.statuses.agent).not.toBe('checking'))
    act(() => result.current.later())
    expect(update).toHaveBeenCalledWith({
      workspaceSetup: { lastCompletedStep: 0, skipped: ['agent'] }
    })
    expect(result.current.currentId).toBe('cloud')
  })

  it('resumes saved progress and records completion when finished', async () => {
    stubApi({})
    const onboarding = {
      ...getDefaultOnboardingState(),
      workspaceSetup: { lastCompletedStep: 3, skipped: ['cloud' as const] }
    }
    const onChange = vi.fn()
    const { result } = renderHook(() => useWorkspaceSetupFlow(onboarding, onChange))
    expect(result.current.currentId).toBe('finish')
    await act(async () => result.current.finish())
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'completed',
        workspaceSetup: { lastCompletedStep: 4, skipped: ['cloud'] },
        checklist: { dismissed: false }
      })
    )
    expect(onChange).toHaveBeenCalled()
  })

  it('turns on chat as the default the first time only', async () => {
    stubApi({})
    renderHook(() => useWorkspaceSetupFlow(getDefaultOnboardingState(), () => {}))
    expect(useAppStore.getState().updateSettings).toHaveBeenCalledWith({
      agentDefaultSurface: 'chat'
    })
    vi.mocked(useAppStore.getState().updateSettings).mockClear()
    renderHook(() =>
      useWorkspaceSetupFlow(
        { ...getDefaultOnboardingState(), workspaceSetup: { lastCompletedStep: 0, skipped: [] } },
        () => {}
      )
    )
    expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
  })
})
