// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ManagedRuntimeInstallState } from '../../../../../shared/managed-runtime-install'
import type { ManagedRuntimeInstallObservation } from '@/runtime/use-managed-runtime-install'
import { RevioAcpAgentRows } from './RevioAcpAgentRows'

const URL = 'https://dl.google.com/agy-extensions/releases/macos/agy.zip'
const SHA = 'b'.repeat(64)
const subject = { target: { kind: 'local' }, runtimeId: null, agent: 'antigravity' } as const

const mocks = vi.hoisted(() => ({
  observations: new Map<string, unknown>(),
  install: vi.fn(),
  read: vi.fn(),
  success: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/runtime/use-managed-runtime-install', () => ({
  useManagedRuntimeInstall: (_target: unknown, agent: string) =>
    mocks.observations.get(agent) ?? { kind: 'inactive' }
}))
vi.mock('@/runtime/managed-runtime-install-status', () => ({
  installManagedRuntime: mocks.install,
  readManagedRuntimeInstall: mocks.read
}))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))

function antigravity(
  patch: Partial<ManagedRuntimeInstallState> = {}
): Extract<ManagedRuntimeInstallObservation, { kind: 'active' }> {
  return {
    kind: 'active',
    subject,
    removable: true,
    snapshot: {
      kind: 'known',
      state: {
        agent: 'antigravity',
        revision: 1,
        available: true,
        version: '1.4.1',
        downloadBytes: 100,
        downloadUrl: URL,
        archiveSha256: SHA,
        installedVersion: null,
        installedCurrent: false,
        source: null,
        operation: null,
        ...patch
      }
    }
  }
}

const op = (phase: 'downloading' | 'succeeded' | 'failed', error?: string) => ({
  id: 'op-1',
  kind: 'install' as const,
  phase,
  downloadedBytes: 0,
  totalBytes: 100,
  ...(error === undefined ? {} : { error })
})

beforeEach(() => {
  mocks.observations.clear()
  mocks.install.mockReset().mockResolvedValue(undefined)
  mocks.read.mockReset().mockReturnValue(antigravity({ operation: op('downloading') }).snapshot)
  mocks.success.mockReset()
  mocks.error.mockReset()
  Object.assign(window, {
    api: {
      preflight: { detectAgents: vi.fn(async () => ['grok']) },
      shell: { openUrl: vi.fn() }
    }
  })
})
afterEach(cleanup)

it('shows the source, version and sha256 and installs nothing until confirmed', async () => {
  mocks.observations.set('antigravity', antigravity())
  render(<RevioAcpAgentRows />)
  expect(screen.getByText('Missing', { selector: '[data-revio-acp-badge]' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Install' }))
  expect(await screen.findByText(URL)).toBeTruthy()
  expect(screen.getByText(SHA)).toBeTruthy()
  expect(screen.getByText('Install Antigravity 1.4.1?')).toBeTruthy()
  expect(mocks.install).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByText(URL)).toBeNull())
  expect(mocks.install).not.toHaveBeenCalled()
})

it("runs the install on confirm, shows Installing… and toasts the layout's success line", async () => {
  mocks.observations.set('antigravity', antigravity())
  const { rerender } = render(<RevioAcpAgentRows />)
  fireEvent.click(screen.getByRole('button', { name: 'Install' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Install' }))
  expect(mocks.install).toHaveBeenCalledTimes(1)
  expect(mocks.install).toHaveBeenCalledWith(subject)

  mocks.observations.set('antigravity', antigravity({ operation: op('downloading') }))
  await act(async () => rerender(<RevioAcpAgentRows />))
  expect(screen.getByRole('button', { name: 'Installing…' })).toHaveProperty('disabled', true)

  mocks.observations.set(
    'antigravity',
    antigravity({ installedVersion: '1.4.1', installedCurrent: true, operation: op('succeeded') })
  )
  await act(async () => rerender(<RevioAcpAgentRows />))
  expect(mocks.success).toHaveBeenCalledWith('Installed Antigravity.')
  expect(screen.getByText('Installed 1.4.1')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
})

it('shows the host error when the install fails', async () => {
  mocks.observations.set('antigravity', antigravity())
  const { rerender } = render(<RevioAcpAgentRows />)
  fireEvent.click(screen.getByRole('button', { name: 'Install' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Install' }))
  await waitFor(() => expect(mocks.read).toHaveBeenCalled())
  mocks.observations.set('antigravity', antigravity({ operation: op('failed', 'sha256 mismatch') }))
  await act(async () => rerender(<RevioAcpAgentRows />))
  expect(mocks.error).toHaveBeenCalledWith('Failed to install Antigravity: sha256 mismatch')
})

it('offers Update only for an older copy, and no install for PATH-only agents', async () => {
  mocks.observations.set('antigravity', antigravity({ installedVersion: '1.3.0' }))
  render(<RevioAcpAgentRows />)
  expect(screen.getByText('Update required')).toBeTruthy()
  await waitFor(() => expect(screen.getAllByText('Installed').length).toBe(1))
  // grok is on PATH; opencode, opencode2 and omp are Missing with their Docs links.
  expect(screen.getAllByText('Missing')).toHaveLength(3)
  expect(screen.getAllByRole('button', { name: 'Docs' })).toHaveLength(4)
  expect(screen.getAllByRole('button', { name: /^(Install|Update)$/ })).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: 'Update' }))
  expect(await screen.findByText('Update Antigravity to 1.4.1?')).toBeTruthy()
  expect(mocks.install).not.toHaveBeenCalled()
})
