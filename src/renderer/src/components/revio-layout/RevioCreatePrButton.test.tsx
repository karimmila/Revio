// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type * as Precheck from './revio-create-pr-precheck'
import type { CreatePrBlock } from './revio-create-pr-precheck'

type Mocks = {
  block: CreatePrBlock | null
  running: boolean
  existingChat: boolean
  launch: () => boolean
  showChat: () => void
  openSettingsPage: () => void
}
const mocks = vi.hoisted((): Mocks => ({
  block: null,
  running: false,
  existingChat: false,
  launch: vi.fn(() => true),
  showChat: vi.fn(),
  openSettingsPage: vi.fn()
}))

vi.mock('@/store', () => {
  const state = {
    settings: {},
    repos: [],
    gitBranchCompareSummaryByWorktree: {},
    openSettingsPage: mocks.openSettingsPage
  }
  const useAppStore = (selector: (value: typeof state) => unknown): unknown => selector(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('./launch-revio-chat', () => ({ launchRevioAgentChat: mocks.launch }))
vi.mock('./revio-prompts-for-worktree', () => ({ revioPromptsForWorktree: () => ({}) }))
vi.mock('./revio-prompts', () => ({ createPrPrompt: () => 'open a pr', manualPrBody: () => '' }))
vi.mock('./open-revio-pull-request', () => ({ openRevioPullRequest: vi.fn() }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/lib/claude-account-add', () => ({ addAndSelectClaudeAccount: vi.fn() }))
vi.mock('./revio-create-pr-precheck', async (original) => ({
  ...(await original<typeof Precheck>()),
  readCreatePrBlock: vi.fn(async () => mocks.block)
}))
vi.mock('./revio-create-pr-chat', () => ({
  createPrChatRunning: () => mocks.running,
  showCreatePrChat: () => {
    mocks.showChat()
    return mocks.existingChat
  },
  startCreatePrChat: (_worktreeId: string, launch: () => boolean) => launch()
}))

import { RevioCreatePrButton } from './RevioCreatePrButton'
import { useRevioSettingsView } from './settings/revio-settings-view'

function SettingsPage(): React.JSX.Element {
  return <output data-testid="page">{useRevioSettingsView().page}</output>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.block = null
  mocks.running = false
  mocks.existingChat = false
})
afterEach(cleanup)

const createButton = (): HTMLElement => screen.getByRole('button', { name: 'Create PR' })

it('starts no chat while signed out of GitHub, and offers the sign-in under the button', async () => {
  mocks.block = { kind: 'github-sign-in', expired: false }
  render(
    <>
      <RevioCreatePrButton worktreeId="w" />
      <SettingsPage />
    </>
  )
  fireEvent.click(createButton())
  expect(await screen.findByText('Sign in with GitHub to open pull requests.')).toBeTruthy()
  expect(mocks.launch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
  expect(mocks.openSettingsPage).toHaveBeenCalledOnce()
  expect(screen.getByTestId('page').textContent).toBe('account')
})

it('says what is missing for a repository with no remote, and for one with no changes', async () => {
  mocks.block = { kind: 'no-remote', repoId: 'r' }
  const view = render(<RevioCreatePrButton worktreeId="w" />)
  fireEvent.click(createButton())
  expect(await screen.findByText('Add a GitHub remote to open pull requests.')).toBeTruthy()
  view.unmount()
  mocks.block = { kind: 'no-changes' }
  render(<RevioCreatePrButton worktreeId="w" />)
  fireEvent.click(createButton())
  expect(await screen.findByText('No changes to open a pull request for.')).toBeTruthy()
  expect(mocks.launch).not.toHaveBeenCalled()
})

it('opens one chat, then shows that chat again instead of another', async () => {
  render(<RevioCreatePrButton worktreeId="w" />)
  fireEvent.click(createButton())
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledOnce())
  mocks.existingChat = true
  await waitFor(() => expect(createButton().hasAttribute('disabled')).toBe(false))
  fireEvent.click(createButton())
  await waitFor(() => expect(mocks.showChat).toHaveBeenCalledTimes(2))
  expect(mocks.launch).toHaveBeenCalledOnce()
})

it('is disabled while the Create PR chat works', () => {
  mocks.running = true
  render(<RevioCreatePrButton worktreeId="w" />)
  expect(createButton().hasAttribute('disabled')).toBe(true)
})
