// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

type SettingUpState = {
  settings: { revioLayout: boolean }
  pendingWorktreeCreations: Record<string, { status: string; worktreeId?: string }>
}

vi.mock('@/store/index', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create<SettingUpState>(() => ({
      settings: { revioLayout: true },
      pendingWorktreeCreations: { c1: { status: 'creating', worktreeId: 'new::/x' } }
    }))
  }
})

const { useAppStore } = await import('@/store/index')
const { useSettingUpRowsFirst } = await import('./use-setting-up-rows-first')

const RANKED = ['runtime:e1|old::/a', 'runtime:e2|new::/x']

afterEach(() => {
  vi.useRealTimers()
})

it('keeps a set-up row first while it finishes and for a while after, then follows the sort', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useSettingUpRowsFirst(RANKED))
  expect(result.current[0]).toBe('runtime:e2|new::/x')

  act(() => useAppStore.setState({ pendingWorktreeCreations: {} }))
  expect(result.current[0]).toBe('runtime:e2|new::/x')

  act(() => vi.advanceTimersByTime(20_000))
  expect(result.current).toEqual(RANKED)
})
