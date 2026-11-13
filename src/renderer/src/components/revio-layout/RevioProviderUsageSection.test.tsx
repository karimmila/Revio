// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))

const store = vi.hoisted((): { rateLimits: Record<string, ProviderRateLimits | null> } => ({
  rateLimits: { claude: null, codex: null }
}))

vi.mock('@/store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T): T => selector(store)
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  store.rateLimits = { claude: null, codex: null }
})

function codexLimits(usedPercent: number, status: ProviderRateLimits['status'] = 'ok') {
  return {
    provider: 'codex' as const,
    session: { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: '4 PM' },
    weekly: null,
    updatedAt: 0,
    error: null,
    status
  }
}

async function render(agent: string | undefined, revioLayout = true): Promise<void> {
  const { revioUsageFooter } = await import('./RevioProviderUsageSection')
  await act(async () => root.render(<div>{revioUsageFooter(revioLayout, agent)}</div>))
}

describe('RevioProviderUsageSection', () => {
  it('shows the Codex windows without a warning while usage is low', async () => {
    store.rateLimits.codex = codexLimits(30)
    await render('codex')
    expect(container.textContent).toContain('Codex usage')
    expect(container.textContent).toContain('5h limit')
    expect(container.textContent).toContain('70% left')
    expect(container.textContent).toContain('Resets 4 PM')
    expect(container.textContent).not.toContain('approaching')
  })

  it('warns near the limit', async () => {
    store.rateLimits.claude = { ...codexLimits(85), provider: 'claude' }
    await render('claude')
    expect(container.textContent).toContain('Claude usage')
    expect(container.textContent).toContain('You’re approaching your Claude usage limit.')
    expect(container.querySelector('[data-revio-usage-low="true"]')).not.toBeNull()
  })

  it('shows loading, then the empty state, when no window is known', async () => {
    store.rateLimits.claude = { ...codexLimits(0, 'fetching'), provider: 'claude', session: null }
    await render('claude')
    expect(container.textContent).toContain('Loading usage…')
    store.rateLimits.claude = null
    await render('claude')
    expect(container.textContent).toContain(
      'Usage data unavailable from provider. It refreshes after Claude responds.'
    )
  })

  it('renders nothing outside the workspace layout or for other agents', async () => {
    store.rateLimits.codex = codexLimits(30)
    await render('codex', false)
    expect(container.textContent).toBe('')
    await render('gemini')
    expect(container.textContent).toBe('')
  })
})
