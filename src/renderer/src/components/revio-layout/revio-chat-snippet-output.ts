import React from 'react'
import { useAppStore } from '@/store'
import { subscribeToPtyData } from '@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions'
import { stripAnsiEscapeSequences } from '../../../../shared/ansi-escape-sequences'
import { isRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'

/** Only the tail is kept: inline output is a glance; the dock tab holds the full scrollback. */
export const SNIPPET_OUTPUT_MAX_CHARS = 16_000
const PTY_WAIT_POLL_MS = 200
const PTY_WAIT_LIMIT_MS = 10_000

let outputs: Readonly<Record<string, string>> = {}
const listeners = new Set<() => void>()

function setOutputs(next: Readonly<Record<string, string>>): void {
  outputs = next
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Terminal bytes as plain lines: escapes gone, CRLF as LF, and a carriage-return redraw (a progress
 * bar) keeps only its last state.
 */
export function plainTerminalText(raw: string): string {
  return stripAnsiEscapeSequences(raw)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.slice(line.lastIndexOf('\r') + 1))
    .join('\n')
}

/**
 * Drops the shell's echo of the typed command (and the prompt before it), and the prompt the shell
 * prints again once the command ends, when they show.
 */
export function snippetOutputText(transcript: string, command: string): string {
  const firstLine = command.trim().split('\n')[0]?.trim() ?? ''
  const lines = transcript.split('\n')
  const echo = firstLine ? lines.findIndex((line) => line.includes(firstLine)) : -1
  const commandLines = command.trim().split('\n').length
  const body = echo >= 0 ? lines.slice(echo + commandLines) : lines
  const prompt = echo >= 0 ? lines[echo].slice(0, lines[echo].indexOf(firstLine)).trim() : ''
  if (prompt && body.at(-1)?.trim().startsWith(prompt)) {
    body.pop()
  }
  const text = body.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  return text.length > SNIPPET_OUTPUT_MAX_CHARS ? text.slice(-SNIPPET_OUTPUT_MAX_CHARS) : text
}

function appendOutput(key: string, chunk: string): void {
  const joined = (outputs[key] ?? '') + chunk
  // Twice the shown cap: the echo trim still needs the start until it has passed it.
  const kept =
    joined.length > 2 * SNIPPET_OUTPUT_MAX_CHARS
      ? joined.slice(-2 * SNIPPET_OUTPUT_MAX_CHARS)
      : joined
  setOutputs({ ...outputs, [key]: kept })
}

/** "Clear output". */
export function clearChatSnippetOutput(key: string): void {
  if (!(key in outputs)) {
    return
  }
  const next = { ...outputs }
  delete next[key]
  setOutputs(next)
}

/**
 * Copies what the snippet's dock tab prints to the code block. The tab's shell appears a moment
 * after the run starts, so this waits for it. A remote shell's bytes do not pass this window, so a
 * remote run shows no inline output. Returns the stop function.
 */
export function watchChatSnippetOutput(key: string, tabId: string): () => void {
  clearChatSnippetOutput(key)
  const unsubscribes: (() => void)[] = []
  const startedAt = Date.now()
  let timer: number | undefined
  const attach = (): void => {
    const layout = useAppStore.getState().terminalLayoutsByTabId[tabId]
    const ptyIds = Object.values(layout?.ptyIdsByLeafId ?? {}).filter(
      (id): id is string => !!id && !isRemoteRuntimePtyId(id)
    )
    if (ptyIds.length > 0) {
      setOutputs({ ...outputs, [key]: '' })
      for (const id of ptyIds) {
        unsubscribes.push(subscribeToPtyData(id, (data) => appendOutput(key, data)))
      }
      return
    }
    if (Date.now() - startedAt < PTY_WAIT_LIMIT_MS) {
      timer = window.setTimeout(attach, PTY_WAIT_POLL_MS)
    }
  }
  attach()
  return () => {
    window.clearTimeout(timer)
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe())
  }
}

/** The snippet's captured output as plain text, or null when it has none to show. */
export function useChatSnippetOutput(key: string | null, command: string): string | null {
  const raw = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (key === null ? undefined : outputs[key])
  )
  return React.useMemo(
    () => (raw === undefined ? null : snippetOutputText(plainTerminalText(raw), command)),
    [raw, command]
  )
}

export function resetChatSnippetOutputsForTest(): void {
  setOutputs({})
}
