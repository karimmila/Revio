import { expect, it, vi } from 'vitest'
import type { RepoAction } from '../../../shared/actions/repo-actions'
import {
  repoActionExitCode,
  runRepoAction,
  runningRepoActionTab,
  scriptEnvExports,
  stopRepoAction,
  stopRunsInOtherWorkspaces,
  worktreeHasRunningAction
} from './repo-action-run'

const store = vi.hoisted(() => {
  const tabs: { id: string }[] = []
  return {
    tabs,
    closeTab: vi.fn((id: string) =>
      tabs.splice(
        tabs.findIndex((tab) => tab.id === id),
        1
      )
    )
  }
})
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ tabsByWorktree: { w: store.tabs }, closeTab: store.closeTab })
  }
}))
vi.mock('@/components/revio-layout/revio-dock-terminals', () => ({
  runInRevioDock: () => null
}))
const quick = vi.hoisted(() => ({ command: '' }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({
  runQuickCommandInNewTab: (args: { command: { command: string } }) => {
    quick.command = args.command.command
    store.tabs.push({ id: 'tab-1' })
    return { tabId: 'tab-1' }
  }
}))
const watch = vi.hoisted((): { exit: ((code: number) => void) | null; stop: () => void } => ({
  exit: null,
  stop: vi.fn()
}))
vi.mock('./repo-action-exit-watch', () => ({
  watchRepoActionExit: (_tabId: string, _name: string, onExit: (code: number) => void) => {
    watch.exit = onExit
    return watch.stop
  }
}))

it('starts an action, and the next ⌘R stops it by closing its tab', () => {
  const action: RepoAction = {
    id: 'dev',
    name: 'Dev',
    script: 'pnpm dev',
    targets: ['local'],
    shared: false
  }
  expect(runRepoAction(action, 'w')).toBe(true)
  expect(runningRepoActionTab('dev', 'w')).toBe('tab-1')
  expect(worktreeHasRunningAction('w')).toBe(true)
  expect(worktreeHasRunningAction('other')).toBe(false)
  expect(stopRepoAction('dev', 'w')).toBe(true)
  expect(store.closeTab).toHaveBeenCalledWith('tab-1')
  expect(runningRepoActionTab('dev', 'w')).toBeNull()
  expect(worktreeHasRunningAction('w')).toBe(false)
  expect(stopRepoAction('dev', 'w')).toBe(false)
})

it('nonconcurrent: a run in one workspace stops the runs of the others', () => {
  const action: RepoAction = {
    id: 'dev',
    name: 'Dev',
    script: 'pnpm dev',
    targets: ['local'],
    shared: false
  }
  store.closeTab.mockClear()
  expect(runRepoAction(action, 'w')).toBe(true)
  expect(stopRunsInOtherWorkspaces('w', ['w'])).toBe(0)
  expect(stopRunsInOtherWorkspaces('other', ['w', 'other'])).toBe(1)
  expect(store.closeTab).toHaveBeenCalledWith('tab-1')
})

it('exports the script environment, quoting values for the shell', () => {
  expect(scriptEnvExports({ ORCA_PORT: '55000', ODD: "it's", 'bad-name': 'x' })).toBe(
    "export ORCA_PORT='55000'; export ODD='it'\\''s';"
  )
})

it('ends the run when the script exits, keeping its code while the tab stays open', () => {
  const action: RepoAction = {
    id: 'check',
    name: 'Check',
    script: 'curl -s localhost:3000',
    targets: ['local'],
    shared: false
  }
  store.tabs.splice(0)
  expect(runRepoAction(action, 'w')).toBe(true)
  expect(quick.command).toContain("printf '\\033[2m■ %s exited %s\\033[0m\\n' 'Check' \"$?\")")
  expect(runningRepoActionTab('check', 'w')).toBe('tab-1')
  expect(repoActionExitCode('check', 'w')).toBeNull()

  watch.exit?.(0)
  expect(runningRepoActionTab('check', 'w')).toBeNull()
  expect(worktreeHasRunningAction('w')).toBe(false)
  expect(repoActionExitCode('check', 'w')).toBe(0)
  // Nothing runs, so ⌘R starts the action again instead of closing the tab.
  expect(stopRepoAction('check', 'w')).toBe(false)

  expect(runRepoAction(action, 'w')).toBe(true)
  expect(repoActionExitCode('check', 'w')).toBeNull()
  watch.exit?.(2)
  expect(repoActionExitCode('check', 'w')).toBe(2)
  store.tabs.splice(0)
  expect(repoActionExitCode('check', 'w')).toBeNull()
})
