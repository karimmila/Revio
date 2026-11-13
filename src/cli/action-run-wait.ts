import { parseRepoActionExit } from '../shared/actions/repo-action-agent-bridge'

export const DEFAULT_ACTION_WAIT_MS = 120_000
export const MAX_ACTION_WAIT_MS = 600_000
const TAIL_LINES = 60
const READ_LIMIT = 400

export type ActionWaitResult = {
  finished: boolean
  timedOut: boolean
  exitCode: number | null
  tail: string[]
}

type WaitDeps = {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
}

type TerminalReadResult = { terminal: { tail: string[]; status?: string } }

type TerminalReader = {
  call: (method: 'terminal.read', params: unknown) => Promise<{ result: TerminalReadResult }>
}

/**
 * Waits for an agent-started action to print its exit line, then returns the output's last lines.
 * The Run tab's shell stays open after the script ends, so the exit line, not the terminal's
 * exit, is the end of the run. A server that never ends returns at the timeout, still running.
 */
export async function waitForActionRun(
  client: TerminalReader,
  handle: string,
  actionName: string,
  timeoutMs: number,
  deps: WaitDeps = {}
): Promise<ActionWaitResult> {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const pollMs = deps.pollMs ?? 500
  const deadline = now() + timeoutMs
  let tail: string[] = []
  for (;;) {
    const read = await client.call('terminal.read', {
      terminal: handle,
      limit: READ_LIMIT
    })
    tail = read.result.terminal.tail
    const exitAt = tail.findLastIndex((line) => parseRepoActionExit(line, actionName) !== null)
    if (exitAt !== -1) {
      return {
        finished: true,
        timedOut: false,
        exitCode: parseRepoActionExit(tail[exitAt] ?? '', actionName),
        tail: tail.slice(0, exitAt + 1).slice(-TAIL_LINES)
      }
    }
    if (read.result.terminal.status === 'exited') {
      return { finished: true, timedOut: false, exitCode: null, tail: tail.slice(-TAIL_LINES) }
    }
    if (now() >= deadline) {
      return { finished: false, timedOut: true, exitCode: null, tail: tail.slice(-TAIL_LINES) }
    }
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())))
  }
}
