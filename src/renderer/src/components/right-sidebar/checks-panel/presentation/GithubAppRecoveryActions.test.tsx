// @vitest-environment happy-dom
import type React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const openSettingsPage = vi.hoisted(() => vi.fn())

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ openSettingsPage }) }
}))

import { useRevioSettingsView } from '@/components/revio-layout/settings/revio-settings-view'
import { RevioGitHubAccount } from '@/components/revio-layout/settings/RevioGitHubAccount'
import { GithubAppRecoveryActions } from './GithubAppRecoveryActions'

function Page(): React.JSX.Element {
  return <output>{useRevioSettingsView().page}</output>
}

beforeEach(() => {
  openSettingsPage.mockClear()
  Object.assign(window, {
    api: {
      cloud: {
        githubStatus: vi.fn(async () => ({ account: null, signInExpired: false })),
        onGithubEvent: vi.fn(() => () => {})
      }
    }
  })
})
afterEach(cleanup)

it('Sign in with GitHub in the Checks tab opens Settings > Account, where the sign-in lives', () => {
  render(
    <>
      <GithubAppRecoveryActions recovery={['github_sign_in']} installOwner={undefined} />
      <Page />
    </>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
  expect(openSettingsPage).toHaveBeenCalledOnce()
  expect(screen.getByRole('status').textContent).toBe('account')
})

it('the GitHub line on Settings > Cloud points to Account', async () => {
  render(
    <>
      <RevioGitHubAccount />
      <Page />
    </>
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in with GitHub' }))
  expect(screen.getAllByRole('status').some((node) => node.textContent === 'account')).toBe(true)
})
