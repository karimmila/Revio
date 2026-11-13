// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'
import { WorkspaceSetupGithubSteps } from '@/components/onboarding/workspace/WorkspaceSetupGithubSteps'
import { RevioCloudGithub } from './RevioCloudGithub'

function status(patch: Partial<CloudGithubStatus> = {}): CloudGithubStatus {
  return {
    app: {
      configured: true,
      host: 'github.com',
      slug: 'revio',
      custom: false,
      authorizationsUrl: 'https://github.com/settings/apps/authorizations'
    },
    account: null,
    signInExpired: false,
    signIn: null,
    repos: [],
    pendingInstallOwner: null,
    coverageError: null,
    migrated: false,
    ...patch
  }
}

const cloud = {
  githubStatus: vi.fn(),
  onGithubEvent: vi.fn(() => () => {}),
  githubSignIn: vi.fn(async () => {}),
  githubCancelSignIn: vi.fn(async () => {}),
  githubOpenVerification: vi.fn(async () => {}),
  githubSignOut: vi.fn(async () => {}),
  githubInstall: vi.fn(async () => {}),
  githubRecheck: vi.fn(async () => {}),
  githubDismissNotice: vi.fn(async () => {})
}
const openUrl = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(window, { api: { cloud, shell: { openUrl } } })
})
afterEach(cleanup)

function show(value: CloudGithubStatus): void {
  cloud.githubStatus.mockResolvedValue(value)
  render(
    <div data-revio-settings="">
      <RevioCloudGithub />
    </div>
  )
}

it('signed out: one Sign in with GitHub button that starts the device flow', async () => {
  show(status())
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in with GitHub' }))
  await waitFor(() => expect(cloud.githubSignIn).toHaveBeenCalledOnce())
})

it('expired: a warning says access expired, and the button says Sign in again', async () => {
  show(status({ signInExpired: true }))
  expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeTruthy()
  expect(screen.getByText('GitHub access expired.')).toBeTruthy()
  expect(document.querySelector('[data-github-expired]')).not.toBeNull()
})

it('onboarding, signed out: the step does not repeat the page subtitle', async () => {
  cloud.githubStatus.mockResolvedValue(status())
  render(<WorkspaceSetupGithubSteps />)
  expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
  expect(screen.queryByText(/The token stays on this Mac/)).toBeNull()
})

it('signing in: numbered steps with the code, Open GitHub and Cancel', async () => {
  show(status({ signIn: { userCode: 'ABCD-1234', verificationUri: 'u', expiresAt: 0 } }))
  expect(await screen.findByText('ABCD-1234')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Waiting for authorization…' })).toHaveProperty(
    'disabled',
    true
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open GitHub' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => {
    expect(cloud.githubOpenVerification).toHaveBeenCalledOnce()
    expect(cloud.githubCancelSignIn).toHaveBeenCalledOnce()
  })
})

it('connected: avatar and login, an options menu, and one install per uncovered owner', async () => {
  show(
    status({
      account: { login: 'octo' },
      repos: [
        { repoId: '1', owner: 'octo', name: 'a', state: 'covered', installUrl: null },
        { repoId: '2', owner: 'acme', name: 'b', state: 'not-covered', installUrl: 'x' },
        { repoId: '3', owner: 'acme', name: 'c', state: 'not-covered', installUrl: 'x' }
      ]
    })
  )
  expect(await screen.findByText('octo')).toBeTruthy()
  expect(document.querySelector('img')?.getAttribute('src')).toBe(
    'https://github.com/octo.png?size=64'
  )
  expect(screen.getByRole('button', { name: 'GitHub options' })).toBeTruthy()
  const installs = screen.getAllByRole('button', { name: /Install on/ })
  expect(installs).toHaveLength(1)
  fireEvent.click(installs[0])
  await waitFor(() => expect(cloud.githubInstall).toHaveBeenCalledWith('acme'))
})

it('pending install: Check again re-checks coverage', async () => {
  show(status({ account: { login: 'octo' }, pendingInstallOwner: 'acme' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Check again' }))
  await waitFor(() => expect(cloud.githubRecheck).toHaveBeenCalledOnce())
})

it('app not configured: shows main’s message and no actions', async () => {
  show(status({ app: { configured: false, message: 'No GitHub App in this build.' } }))
  expect(await screen.findByText('No GitHub App in this build.')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('onboarding: step 1 is done and step 2 lists repositories once signed in', async () => {
  cloud.githubStatus.mockResolvedValue(
    status({
      account: { login: 'octo' },
      repos: [{ repoId: '1', owner: 'octo', name: 'a', state: 'covered', installUrl: null }]
    })
  )
  render(<WorkspaceSetupGithubSteps />)
  expect(await screen.findByText('Signed in to GitHub as')).toBeTruthy()
  expect(screen.getByText('All repositories covered.')).toBeTruthy()
  const steps = document.querySelectorAll('[data-github-step-state]')
  expect([...steps].map((step) => step.getAttribute('data-github-step-state'))).toEqual([
    'done',
    'current'
  ])
})

it('sign out asks first, links to revoking on GitHub, and only signs out on confirm', async () => {
  show(status({ account: { login: 'octo' } }))
  const options = await screen.findByRole('button', { name: 'GitHub options' })
  fireEvent.pointerDown(options, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
  const dialog = await screen.findByRole('dialog', { name: 'Sign out of GitHub?' })
  expect(cloud.githubSignOut).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Revoke in GitHub settings' }))
  expect(openUrl).toHaveBeenCalledWith('https://github.com/settings/apps/authorizations')
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(cloud.githubSignOut).toHaveBeenCalledOnce())
  await waitFor(() => expect(dialog.isConnected).toBe(false))
})
