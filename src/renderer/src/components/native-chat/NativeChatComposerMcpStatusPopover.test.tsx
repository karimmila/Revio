// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const call = vi.fn()
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: (...args: unknown[]) => call(...args)
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ''))
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  call.mockReset()
  call.mockResolvedValue({
    kind: 'servers',
    servers: [{ name: 'linear', status: 'connected', toolCount: 3 }]
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

async function render(sessionId = 's1'): Promise<void> {
  const { NativeChatComposerMcpStatusPopover } =
    await import('./NativeChatComposerMcpStatusPopover')
  await act(async () =>
    root.render(
      <TooltipProvider>
        <NativeChatComposerMcpStatusPopover request={{ sessionId, target: { kind: 'local' } }} />
      </TooltipProvider>
    )
  )
}

function trigger(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('[data-native-chat-mcp-status]')
  if (!button) {
    throw new Error('no MCP button')
  }
  return button
}

describe('NativeChatComposerMcpStatusPopover', () => {
  it('reads MCP status only when opened, and lists the servers', async () => {
    await render()
    expect(trigger().getAttribute('aria-label')).toBe('MCP servers')
    expect(call).not.toHaveBeenCalled()
    await act(async () => {
      trigger().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      trigger().click()
    })
    expect(call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.mcpStatus', {
      sessionId: 's1'
    })
    expect(document.body.textContent).toContain('MCPs')
    expect(document.body.textContent).toContain('linear')
    expect(document.body.textContent).toContain('3 tools')
  })

  it('Refresh reads again; re-rendering the same chat does not', async () => {
    await render()
    await act(async () => {
      trigger().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      trigger().click()
    })
    expect(call).toHaveBeenCalledTimes(1)
    await render()
    expect(call).toHaveBeenCalledTimes(1)
    const refresh = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh MCP status"]'
    )
    await act(async () => refresh?.click())
    expect(call).toHaveBeenCalledTimes(2)
  })
})

describe('nativeChatMcpStatusRequest', () => {
  it('gives Claude chats the MCP control and Codex none', async () => {
    const { nativeChatMcpStatusRequest } = await import('./use-native-chat-mcp-status')
    const request = { sessionId: 's1', target: { kind: 'local' as const } }
    expect(nativeChatMcpStatusRequest('claude', request)).toEqual({ mcpStatus: request })
    expect(nativeChatMcpStatusRequest('codex', request)).toEqual({})
  })
})
