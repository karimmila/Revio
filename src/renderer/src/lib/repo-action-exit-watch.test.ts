import { beforeEach, expect, it, vi } from 'vitest'
import { repoActionExitInOutput, watchRepoActionExit } from './repo-action-exit-watch'

type Layouts = Record<string, { ptyIdsByLeafId: Record<string, string> }>
const store = vi.hoisted((): { layouts: Layouts; listeners: Set<() => void> } => ({
  layouts: {},
  listeners: new Set()
}))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ terminalLayoutsByTabId: store.layouts }),
    subscribe: (listener: () => void) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    }
  }
}))
const pty = vi.hoisted(() => ({
  watchers: new Map<string, (data: string) => void>(),
  unsubscribe: vi.fn()
}))
vi.mock('@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: (id: string, watcher: (data: string) => void) => {
    pty.watchers.set(id, watcher)
    return pty.unsubscribe
  }
}))

beforeEach(() => {
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  store.layouts = {}
  store.listeners.clear()
  pty.watchers.clear()
  pty.unsubscribe.mockClear()
})

it('reads the exit code from a complete exit line only', () => {
  const dim = (text: string): string => `\u001b[2m${text}\u001b[0m`
  expect(repoActionExitInOutput(`${dim('▶ Dev')}\r\nready\r\n`, 'Dev')).toBeNull()
  expect(repoActionExitInOutput(`ready\r\n${dim('■ Dev exited 0')}\r\n% `, 'Dev')).toBe(0)
  // ⌃C: the terminal echoes ^C on the exit line itself.
  expect(repoActionExitInOutput(`^C${dim('■ Dev exited 130')}\r\n`, 'Dev')).toBe(130)
  // Still being written: "exited 1" may be the start of "exited 130".
  expect(repoActionExitInOutput('■ Dev exited 1', 'Dev')).toBeNull()
  // Another action's line, or the echoed command with its printf placeholders.
  expect(repoActionExitInOutput('■ Build exited 0\r\n', 'Dev')).toBeNull()
  expect(repoActionExitInOutput("printf '■ %s exited %s' 'Dev'\r\n", 'Dev')).toBeNull()
})

it('attaches when the tab gets its shell and reports the exit once, across chunks', () => {
  const onExit = vi.fn()
  watchRepoActionExit('tab-1', 'Dev', onExit)
  expect(pty.watchers.size).toBe(0)

  store.layouts = { 'tab-1': { ptyIdsByLeafId: { leaf: 'pty-1' } } }
  for (const listener of store.listeners) {
    listener()
  }
  expect(store.listeners.size).toBe(0)
  const write = pty.watchers.get('pty-1')
  write?.('▶ Dev\r\nserver up\r\n■ Dev exi')
  expect(onExit).not.toHaveBeenCalled()
  write?.('ted 3\r\n')
  expect(onExit).toHaveBeenCalledWith(3)
  expect(pty.unsubscribe).toHaveBeenCalledTimes(1)
  write?.('■ Dev exited 0\r\n')
  expect(onExit).toHaveBeenCalledTimes(1)
})

it('stops watching when the run is stopped first', () => {
  store.layouts = { 'tab-1': { ptyIdsByLeafId: { leaf: 'pty-1' } } }
  const onExit = vi.fn()
  const stop = watchRepoActionExit('tab-1', 'Dev', onExit)
  stop()
  pty.watchers.get('pty-1')?.('■ Dev exited 0\r\n')
  expect(onExit).not.toHaveBeenCalled()
  expect(pty.unsubscribe).toHaveBeenCalledTimes(1)
})
