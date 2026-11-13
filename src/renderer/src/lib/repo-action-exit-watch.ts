import { useAppStore } from '@/store'
import { subscribeToPtyData } from '@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions'
import { stripAnsiEscapeSequences } from '../../../shared/ansi-escape-sequences'
import { parseRepoActionExit } from '../../../shared/actions/repo-action-agent-bridge'
import { isRemoteRuntimePtyId } from '../../../shared/remote-runtime/remote-runtime-pty-id'

// The exit line is short; this much also holds an escape sequence cut by the chunk before it.
const TAIL_CHARS = 4096
const PTY_WAIT_LIMIT_MS = 30_000

/**
 * The exit code in a Run tab's output, once the run's `■ <name> exited <code>` line is complete.
 * A line still being written is left for the next chunk, so "exited 1" is never read from
 * "exited 130".
 */
export function repoActionExitInOutput(output: string, actionName: string): number | null {
  const lines = stripAnsiEscapeSequences(output).split(/\r\n|\n|\r/)
  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const code = parseRepoActionExit(lines[index] ?? '', actionName)
    if (code !== null) {
      return code
    }
  }
  return null
}

function localPtyIds(tabId: string): string[] {
  const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
  return Object.values(layout?.ptyIdsByLeafId ?? {}).filter(
    (id): id is string => !!id && !isRemoteRuntimePtyId(id)
  )
}

/**
 * Reads the Run tab's output for the action's exit line and reports its code once. The tab's
 * shell appears a moment after the run starts; this attaches on the store change that names it,
 * so no output passes unread. A remote shell's bytes do not pass this window: such a run ends
 * only when its tab closes. Returns the stop function.
 */
export function watchRepoActionExit(
  tabId: string,
  actionName: string,
  onExit: (code: number) => void
): () => void {
  let tail = ''
  let stopped = false
  let unsubscribeStore: (() => void) | null = null
  const unsubscribes: (() => void)[] = []
  const stop = (): void => {
    stopped = true
    window.clearTimeout(timer)
    unsubscribeStore?.()
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe())
  }
  const onData = (data: string): void => {
    if (stopped) {
      return
    }
    tail = (tail + data).slice(-TAIL_CHARS)
    const code = repoActionExitInOutput(tail, actionName)
    if (code !== null) {
      stop()
      onExit(code)
    }
  }
  const attach = (): boolean => {
    const ptyIds = localPtyIds(tabId)
    for (const id of ptyIds) {
      unsubscribes.push(subscribeToPtyData(id, onData))
    }
    return ptyIds.length > 0
  }
  const timer = window.setTimeout(() => unsubscribeStore?.(), PTY_WAIT_LIMIT_MS)
  if (attach()) {
    window.clearTimeout(timer)
  } else {
    unsubscribeStore = useAppStore.subscribe(() => {
      if (!stopped && attach()) {
        unsubscribeStore?.()
        unsubscribeStore = null
        window.clearTimeout(timer)
      }
    })
  }
  return stop
}
