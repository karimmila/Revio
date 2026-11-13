// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { readPersistedFloatingTerminalPanelViewState } from '@/components/floating-terminal/floating-terminal-panel-view-state'
import { getDefaultSettings } from '../../../../shared/constants'
import { useRevioDockOpenPersistence } from './revio-dock-open-persistence'

beforeEach(() => {
  window.localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home'), floatingTerminalEnabled: true }
  })
})

afterEach(cleanup)

it('saves the dock opening and folding, so a restart restores it', () => {
  renderHook(() => useRevioDockOpenPersistence())
  expect(readPersistedFloatingTerminalPanelViewState()).toBeNull()
  useAppStore.getState().setFloatingWorkspacePanelOpen(true)
  expect(readPersistedFloatingTerminalPanelViewState()?.open).toBe(true)
  useAppStore.getState().setFloatingWorkspacePanelOpen(false)
  expect(readPersistedFloatingTerminalPanelViewState()?.open).toBe(false)
})

it('does not save the close that switching the panel off in settings causes', () => {
  renderHook(() => useRevioDockOpenPersistence())
  useAppStore.getState().setFloatingWorkspacePanelOpen(true)
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home'), floatingTerminalEnabled: false }
  })
  useAppStore.getState().setFloatingWorkspacePanelOpen(false)
  expect(readPersistedFloatingTerminalPanelViewState()?.open).toBe(true)
})

it('stops saving once the layout is gone', () => {
  const view = renderHook(() => useRevioDockOpenPersistence())
  view.unmount()
  useAppStore.getState().setFloatingWorkspacePanelOpen(true)
  expect(readPersistedFloatingTerminalPanelViewState()).toBeNull()
})
