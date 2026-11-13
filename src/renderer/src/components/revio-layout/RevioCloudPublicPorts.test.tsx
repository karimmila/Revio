// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudPublicPorts } from '../../../../shared/cloud/cloud-types'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const backend = vi.hoisted(() => {
  const state: { ports: CloudPublicPorts } = { ports: { shared: [], listening: [] } }
  return state
})
const publicPorts = vi.fn(async () => structuredClone(backend.ports))
const sharePort = vi.fn(async (_env: string, port: number) => {
  const url = `https://sb-x${port}.vercel.run`
  backend.ports.listening = backend.ports.listening.filter((entry) => entry.port !== port)
  backend.ports.shared.push({ port, url })
  return { port, url }
})
const unsharePort = vi.fn(async (_env: string, port: number) => {
  backend.ports.shared = backend.ports.shared.filter((entry) => entry.port !== port)
  backend.ports.listening.push({ port, loopbackOnly: false })
})
const writeClipboardText = vi.fn(async () => undefined)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  backend.ports = { shared: [], listening: [{ port: 3000, loopbackOnly: false }] }
  Object.assign(window, {
    api: { cloud: { publicPorts, sharePort, unsharePort }, ui: { writeClipboardText } }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

async function render(isVisible = true): Promise<void> {
  const { RevioCloudPublicPorts } = await import('./RevioCloudPublicPorts')
  await act(async () =>
    root.render(<RevioCloudPublicPorts environmentId="env-1" isVisible={isVisible} />)
  )
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label || candidate.getAttribute('aria-label') === label
  )
  if (!found) {
    throw new Error(`No button "${label}" in: ${container.textContent}`)
  }
  return found
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

describe('RevioCloudPublicPorts', () => {
  it('shares nothing until the person confirms', async () => {
    await render()
    expect(container.textContent).toContain(':3000')
    await click('Share publicly')
    expect(sharePort).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Share port 3000 publicly?')
    await click('Cancel')
    expect(sharePort).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Share port 3000 publicly?')
  })

  it('confirm shows the link, the warning, Copy and Disable', async () => {
    await render()
    await click('Share publicly')
    await click('Share')
    expect(sharePort).toHaveBeenCalledWith('env-1', 3000)
    expect(container.textContent).toContain('https://sb-x3000.vercel.run')
    expect(container.textContent).toContain('Anyone with this link can reach it.')
    await click('Copy')
    expect(writeClipboardText).toHaveBeenCalledWith('https://sb-x3000.vercel.run')
    await click('Disable')
    expect(unsharePort).toHaveBeenCalledWith('env-1', 3000)
    expect(container.textContent).not.toContain('https://sb-x3000.vercel.run')
    expect(container.textContent).toContain('Share publicly')
  })

  it('shows a failed share as an error and keeps the port private', async () => {
    sharePort.mockRejectedValueOnce(
      new Error("Error invoking remote method 'cloud:sharePort': Error: Vercel said no")
    )
    await render()
    await click('Share publicly')
    await click('Share')
    expect(toastError).toHaveBeenCalledWith('Vercel said no')
    expect(container.textContent).not.toContain('vercel.run')
  })

  it('does not ask the sandbox while the panel is closed', async () => {
    await render(false)
    expect(publicPorts).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')
  })
})
