// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import { getDefaultOnboardingState } from '../../../../shared/onboarding-defaults'
import OnboardingEntry from './OnboardingEntry'

vi.mock('./OnboardingFlow', () => ({ default: () => <div>classic</div> }))
vi.mock('./workspace/WorkspaceOnboardingFlow', () => ({
  WorkspaceOnboardingFlow: () => <div>workspace</div>
}))

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true)
})

afterEach(cleanup)

function renderEntry(): void {
  render(<OnboardingEntry onboarding={getDefaultOnboardingState()} onOnboardingChange={vi.fn()} />)
}

describe('OnboardingEntry', () => {
  it('shows the fork first run in the Workspace Layout', () => {
    useAppStore.setState({ settings: { ...getDefaultSettings('/h'), revioLayout: true } })
    renderEntry()
    expect(screen.getByText('workspace')).toBeTruthy()
  })

  it('keeps the upstream flow for the classic layout', () => {
    useAppStore.setState({ settings: { ...getDefaultSettings('/h'), revioLayout: false } })
    renderEntry()
    expect(screen.getByText('classic')).toBeTruthy()
  })

  it('waits for settings so the wrong flow never flashes', () => {
    useAppStore.setState({ settings: null })
    renderEntry()
    expect(screen.queryByText('classic')).toBeNull()
    expect(screen.queryByText('workspace')).toBeNull()
  })
})
