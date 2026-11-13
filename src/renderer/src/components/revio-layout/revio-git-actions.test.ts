import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  listenForRevioGitActions,
  remoteSyncState,
  requestRevioGitAction
} from './revio-git-actions'

let stop: (() => void) | null = null
afterEach(() => stop?.())

it('runs a key action on the mounted strip, or opens Changes and runs it once the strip mounts', () => {
  const setTab = vi.fn()
  useAppStore.setState({ setRightSidebarTab: setTab, setRightSidebarOpen: vi.fn() })
  requestRevioGitAction('rebase_base')
  expect(setTab).toHaveBeenCalledWith('source-control')
  const run = vi.fn(() => true)
  stop = listenForRevioGitActions(run)
  expect(run).toHaveBeenCalledWith('rebase_base')
  requestRevioGitAction('pull')
  expect(run).toHaveBeenLastCalledWith('pull')
  expect(setTab).toHaveBeenCalledTimes(1)
})

it('calls a branch both ahead of and behind its remote incompatible', () => {
  expect(remoteSyncState(2, 3)).toBe('incompatible')
  expect(remoteSyncState(0, 3)).toBe('behind')
  expect(remoteSyncState(2, 0)).toBe('ahead')
  expect(remoteSyncState(0, 0)).toBeNull()
})
