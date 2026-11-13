// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  clearRevioAsleepView,
  nextAsleepView,
  showAsleepViewAfterSleep,
  useIsRevioAsleepView,
  useRevioAsleepViewId
} from './revio-asleep-view'

const initialState = useAppStore.getState()
const CLOUD = 'vm-repo::/vercel/app'
const OTHER = 'vm-repo-2::/vercel/other'

const worktree = (id: string): Worktree => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the view reads only the id.
  return { id, repoId: id.split('::')[0], path: id.split('::')[1], displayName: 'App' } as Worktree
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'terminal',
    activeWorktreeId: CLOUD,
    activePendingCreationId: null,
    worktreesByRepo: { 'vm-repo': [worktree(CLOUD)], 'vm-repo-2': [worktree(OTHER)] }
  })
})

afterEach(() => {
  act(() => clearRevioAsleepView())
  cleanup()
  useAppStore.setState(initialState, true)
})

it('keeps the slept workspace selected in place of Home, until it is opened again', () => {
  const shown = renderHook(() => useRevioAsleepViewId())
  const row = renderHook(() => useIsRevioAsleepView(CLOUD))
  expect(shown.result.current).toBeNull()

  act(() => showAsleepViewAfterSleep(CLOUD))
  // The sleep takes the workspace off screen (workspace-sleep-follower).
  act(() => useAppStore.setState({ activeWorktreeId: null }))
  expect(shown.result.current).toBe(CLOUD)
  expect(row.result.current).toBe(true)

  // Wake opens it again.
  act(() => useAppStore.setState({ activeWorktreeId: CLOUD }))
  expect(shown.result.current).toBeNull()
  expect(row.result.current).toBe(false)
  // And Home after that is Home.
  act(() => useAppStore.setState({ activeWorktreeId: null }))
  expect(shown.result.current).toBeNull()
})

it('ends when another workspace, another page or Home takes the screen', () => {
  const shown = renderHook(() => useRevioAsleepViewId())
  const sleep = (): void => {
    act(() => useAppStore.setState({ activeView: 'terminal', activeWorktreeId: CLOUD }))
    act(() => showAsleepViewAfterSleep(CLOUD))
    act(() => useAppStore.setState({ activeWorktreeId: null }))
    expect(shown.result.current).toBe(CLOUD)
  }
  sleep()
  act(() => useAppStore.setState({ activeWorktreeId: OTHER }))
  expect(shown.result.current).toBeNull()

  sleep()
  act(() => useAppStore.setState({ activeView: 'settings' }))
  expect(shown.result.current).toBeNull()

  sleep()
  act(() => clearRevioAsleepView())
  expect(shown.result.current).toBeNull()

  sleep()
  // Archived while asleep: nothing is left to wake.
  act(() => useAppStore.setState({ worktreesByRepo: { 'vm-repo-2': [worktree(OTHER)] } }))
  expect(shown.result.current).toBeNull()
})

it('drops a sleep that never started, so a later Home is not mistaken for it', () => {
  const state = useAppStore.getState()
  const asked = { worktreeId: CLOUD, askedAt: 1_000, left: false }
  expect(nextAsleepView(asked, state, 2_000)).toBe(asked)
  const offScreen = { ...state, activeWorktreeId: null }
  expect(nextAsleepView(asked, offScreen, 2_000)).toEqual({ ...asked, left: true })
  expect(nextAsleepView(asked, offScreen, 60_000)).toBeNull()
})
