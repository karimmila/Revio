// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: object }) => unknown) => selector({ settings: {} })
}))

import { WorkspaceSetupGithubStep } from './WorkspaceSetupGithubStep'

const waiting: CloudGithubStatus = {
  app: {
    configured: true,
    host: 'github.com',
    slug: 'revio',
    custom: false,
    authorizationsUrl: 'https://github.com/settings/apps/authorizations'
  },
  account: null,
  signInExpired: false,
  signIn: {
    userCode: 'ABCD-1234',
    verificationUri: 'https://github.com/login/device',
    expiresAt: 0
  },
  repos: [],
  pendingInstallOwner: null,
  coverageError: null,
  migrated: false
}

const scrollIntoView = vi.fn()

beforeEach(() => {
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
  Object.assign(window, {
    api: {
      cloud: { githubStatus: vi.fn(async () => waiting), onGithubEvent: vi.fn(() => () => {}) },
      ui: { writeClipboardText: vi.fn(async () => {}) }
    }
  })
})
afterEach(cleanup)

it('puts the device code above a folded permission list and scrolls it into view', async () => {
  const { container } = render(<WorkspaceSetupGithubStep status="not-connected" />)
  const open = await screen.findByRole('button', { name: /Open GitHub/ })
  const permissions = container.querySelector('details[data-github-permissions]')
  expect(permissions).not.toBeNull()
  expect(permissions?.hasAttribute('open')).toBe(false)
  expect(screen.getByText('ABCD-1234')).toBeTruthy()
  // The folded list comes after the sign-in steps.
  const order = [...container.querySelectorAll('button, details')]
  expect(order.indexOf(open)).toBeLessThan(permissions ? order.indexOf(permissions) : -1)
  expect(scrollIntoView).toHaveBeenCalled()
})
