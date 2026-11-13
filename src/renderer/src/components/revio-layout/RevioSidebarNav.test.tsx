import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

type NavState = {
  activeView: string
  activeWorktreeId: string | null
  activePendingCreationId: string | null
  pendingWorktreeCreations: Record<string, { status: string; loaderVisible: boolean }>
  agentDashboardDrawerOpen: boolean
  settings: { experimentalAgentDashboardPopout: boolean }
}

const state = vi.hoisted((): { current: NavState } => ({
  current: {
    activeView: 'terminal',
    activeWorktreeId: null,
    activePendingCreationId: null,
    pendingWorktreeCreations: {},
    agentDashboardDrawerOpen: false,
    settings: { experimentalAgentDashboardPopout: false }
  }
}))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (select: (s: typeof state.current) => unknown) => select(state.current),
    { getState: () => state.current }
  )
}))
vi.mock('@/hooks/useShortcutLabel', () => ({ useShortcutKeyComboDetails: () => [] }))
vi.mock('./RevioLocationSwitcher', () => ({ RevioLocationSwitcher: () => null }))
vi.mock('@/components/contextual-tours/workspace-creation-tour-handoff', () => ({
  openWorkspaceCreationComposerWithTourHandoff: vi.fn()
}))

import { RevioSidebarNav } from './RevioSidebarNav'

describe('RevioSidebarNav', () => {
  it('has no Pull requests board; Dashboard only while its experiment is on', () => {
    const off = renderToStaticMarkup(<RevioSidebarNav />)
    expect(off).not.toContain('Pull requests')
    expect(off).not.toContain('Dashboard')
    state.current = { ...state.current, settings: { experimentalAgentDashboardPopout: true } }
    const html = renderToStaticMarkup(<RevioSidebarNav />)
    expect(html).toContain('Dashboard')
    expect(html).not.toContain('Pull requests')
  })

  it('selects Home only while no workspace being set up is on screen', () => {
    const homeCurrent = (): boolean =>
      /aria-current="page"[^>]*>(?:(?!<\/button>).)*Home/s.test(
        renderToStaticMarkup(<RevioSidebarNav />)
      )
    state.current = {
      ...state.current,
      activePendingCreationId: null,
      pendingWorktreeCreations: {}
    }
    expect(homeCurrent()).toBe(true)
    state.current = {
      ...state.current,
      activePendingCreationId: 'c1',
      pendingWorktreeCreations: { c1: { status: 'creating', loaderVisible: true } }
    }
    expect(homeCurrent()).toBe(false)
  })
})
