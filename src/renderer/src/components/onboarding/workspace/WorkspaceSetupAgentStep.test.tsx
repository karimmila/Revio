// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WorkspaceSetupLive } from './use-workspace-setup-statuses'
import { WorkspaceSetupAgentStep } from './WorkspaceSetupAgentStep'

const loginRoute = vi.fn()
const onCheckTools = vi.fn()
const writeClipboardText = vi.fn(async () => {})
const openUrl = vi.fn()
const refresh = vi.fn()

function live(patch: Partial<WorkspaceSetupLive> = {}): WorkspaceSetupLive {
  return {
    statuses: {
      agent: 'not-connected',
      cloud: 'not-connected',
      project: 'not-connected',
      github: 'not-connected'
    },
    claudeMac: 'not-connected',
    claudeRoute: 'none',
    claudeCloudTokenSet: false,
    vercel: null,
    github: null,
    refresh,
    setVercel: vi.fn(),
    ...patch
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  loginRoute.mockResolvedValue('none')
  Object.assign(window, {
    api: {
      claudeAccounts: { loginRoute },
      ui: { writeClipboardText },
      shell: { openUrl }
    }
  })
})
afterEach(cleanup)

it('copies the sign-in command with its Copy button', async () => {
  render(
    <WorkspaceSetupAgentStep live={live()} claudeInstalled={true} onCheckTools={onCheckTools} />
  )
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy command' })[0])
  expect(writeClipboardText).toHaveBeenCalledWith('claude')
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()
})

it('Check again answers in words when Claude is still signed out', async () => {
  render(
    <WorkspaceSetupAgentStep live={live()} claudeInstalled={true} onCheckTools={onCheckTools} />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
  expect(screen.getByText('Checking…')).toBeTruthy()
  expect(await screen.findByText('Still not signed in')).toBeTruthy()
  expect(refresh).toHaveBeenCalledWith({ claudeUsage: true })
})

it('Check again leaves no "still signed out" line once Claude is signed in', async () => {
  loginRoute.mockResolvedValue('system')
  render(
    <WorkspaceSetupAgentStep live={live()} claudeInstalled={true} onCheckTools={onCheckTools} />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
  await waitFor(() => expect(refresh).toHaveBeenCalled())
  expect(screen.queryByText('Still not signed in')).toBeNull()
  expect(screen.queryByText('Checking…')).toBeNull()
})

it('Check again also probes the tools again', async () => {
  render(
    <WorkspaceSetupAgentStep live={live()} claudeInstalled={null} onCheckTools={onCheckTools} />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
  expect(onCheckTools).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(refresh).toHaveBeenCalled())
})

it('says how to install Claude Code when no claude command is found', () => {
  render(
    <WorkspaceSetupAgentStep
      live={live({ claudeMac: 'connected', claudeRoute: 'apiKey' })}
      claudeInstalled={false}
      onCheckTools={onCheckTools}
    />
  )
  expect(screen.getByText('Not installed')).toBeTruthy()
  expect(screen.getByText('curl -fsSL https://claude.ai/install.sh | bash')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Install guide' }))
  expect(openUrl).toHaveBeenCalledWith('https://docs.claude.com/en/docs/claude-code/setup')
  expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
})
