// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type React from 'react'

const store = vi.hoisted(() => ({ closeModal: vi.fn(), openSettingsPage: vi.fn() }))

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('./use-branches-in-use', () => ({ useBranchesInUse: () => new Set<string>() }))

import { Command } from '@/components/ui/command'
import { resetGithubSignInStateForTest } from '@/lib/github-sign-in-state'
import { useRevioSettingsView } from '@/components/revio-layout/settings/revio-settings-view'
import { SmartWorkspaceSourceResultList } from './SmartWorkspaceSourceResultList'

type Model = React.ComponentProps<typeof SmartWorkspaceSourceResultList>['model']

function model(mode: Model['mode']): Model {
  const fields = {
    mode,
    mrStateFilters: [],
    typedTextActionRow: null,
    jiraSource: { intent: null, errorKind: null },
    loading: false,
    searchResultRows: [],
    linearStatusChecked: true,
    linearStatus: { connected: false },
    linearReadError: null,
    reserveLinearLoadingResults: false,
    showLinearUrlLoadingFeedback: false
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the list reads only the fields set here
  return fields as unknown as Model
}

function Page(): React.JSX.Element {
  return <output>{useRevioSettingsView().page}</output>
}

function show(mode: Model['mode'], account: { login: string } | null): void {
  Object.assign(window, {
    api: {
      cloud: {
        githubStatus: vi.fn(async () => ({ app: { configured: true }, account })),
        onGithubEvent: vi.fn(() => () => {})
      }
    }
  })
  render(
    <Command>
      <SmartWorkspaceSourceResultList model={model(mode)} onSelect={vi.fn()} />
      <Page />
    </Command>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetGithubSignInStateForTest()
})
afterEach(cleanup)

it('asks to sign in with GitHub instead of "Start typing" while signed out', async () => {
  show('github', null)
  expect(
    await screen.findByText('Sign in with GitHub to search pull requests and issues')
  ).toBeTruthy()
  expect(screen.queryByText(/Start typing/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
  expect(store.closeModal).toHaveBeenCalledOnce()
  expect(store.openSettingsPage).toHaveBeenCalledOnce()
  expect(document.querySelector('output')?.textContent).toBe('account')
})

it('keeps the search hint when signed in, and on tabs that do not search GitHub', async () => {
  show('github', { login: 'octo' })
  expect(await screen.findByText('Start typing to search GitHub PRs and issues.')).toBeTruthy()
  cleanup()
  resetGithubSignInStateForTest()
  show('branches', null)
  expect(await screen.findByText('No matching branches.')).toBeTruthy()
  expect(screen.queryByText(/Sign in with GitHub to search/)).toBeNull()
})
