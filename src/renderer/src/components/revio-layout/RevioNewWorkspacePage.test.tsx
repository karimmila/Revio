// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type State = {
  settings: Record<string, unknown> | null
  activeModal: string
  modalData: Record<string, unknown>
  activeWorktreeId: string | null
  activeView: string
  closeModal: () => void
}
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const closeModal = vi.fn()
  let state: State = {
    settings: null,
    activeModal: 'none',
    modalData: {},
    activeWorktreeId: 'wt-1',
    activeView: 'terminal',
    closeModal
  }
  return {
    closeModal,
    get: () => state,
    set: (next: Partial<State>) => {
      state = { ...state, ...next }
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
})

vi.mock('@/store', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useAppStore: <T,>(selector: (state: State) => T): T =>
      useSyncExternalStore(store.subscribe, () => selector(store.get()))
  }
})
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/components/NewWorkspaceComposerModal', () => ({
  selectComposerModalData: (state: State) => state.modalData,
  QuickTabBody: () => <input data-testid="composer" data-workspace-composer-initial-focus="" />
}))
vi.mock('@/lib/workspace-composer-initial-focus', () => ({
  getWorkspaceComposerInitialFocusTarget: (root: HTMLElement) => root.querySelector('input')
}))

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  store.closeModal.mockReset()
  store.set({
    settings: { revioLayout: true, revioNewWorkspacePage: true },
    activeModal: 'new-workspace-composer',
    modalData: {},
    activeWorktreeId: 'wt-1',
    activeView: 'terminal'
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const { RevioNewWorkspacePage } = await import('./RevioNewWorkspacePage')
  await act(async () => root.render(<RevioNewWorkspacePage />))
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

const page = (): Element | null => document.querySelector('[data-revio-new-workspace-page]')

describe('RevioNewWorkspacePage', () => {
  it('shows the Create composer as a page and focuses it', () => {
    expect(page()).not.toBeNull()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('composer')
  })

  it('stays out of the way with the setting off, outside Create, or for a direct setup', async () => {
    await act(async () => store.set({ settings: { revioLayout: true } }))
    expect(page()).toBeNull()
    await act(async () =>
      store.set({
        settings: { revioLayout: true, revioNewWorkspacePage: true },
        activeModal: 'none'
      })
    )
    expect(page()).toBeNull()
    await act(async () =>
      store.set({ activeModal: 'new-workspace-composer', modalData: { directSetup: { id: 'x' } } })
    )
    expect(page()).toBeNull()
  })

  it('closes when another workspace opens', async () => {
    await act(async () => store.set({ activeWorktreeId: 'wt-2' }))
    expect(store.closeModal).toHaveBeenCalled()
  })

  it('closes on Escape pressed in the page', async () => {
    const input = document.querySelector('input')
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(store.closeModal).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape pressed outside the page or while a menu is open', async () => {
    const { revioCreatePageEscapes } = await import('./revio-new-workspace-page')
    const inside = document.querySelector('input')
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const event = (target: EventTarget | null) => ({
      key: 'Escape',
      defaultPrevented: false,
      target
    })
    expect(revioCreatePageEscapes(event(outside), page(), document)).toBe(false)
    const menu = document.createElement('div')
    menu.setAttribute('data-radix-popper-content-wrapper', '')
    document.body.appendChild(menu)
    expect(revioCreatePageEscapes(event(inside), page(), document)).toBe(false)
    menu.remove()
    expect(revioCreatePageEscapes(event(inside), page(), document)).toBe(true)
  })
})
