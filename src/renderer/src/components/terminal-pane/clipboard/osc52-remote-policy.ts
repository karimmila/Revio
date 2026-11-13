// Sandbox→Mac clipboard policy for OSC 52 writes (security audit, 2026-11-10).
// A cloud sandbox or SSH host must not be able to stage text on the Mac clipboard
// behind the user's back (paste-jacking). Only a shell the user is typing into may
// copy, the text is capped, and every copy is announced. Reads (`?`) are refused
// for every pane in shared/osc52-clipboard.ts and never reach this policy.

/** Where the bytes of a terminal pane come from, as far as OSC 52 is concerned. */
export type Osc52PaneSource =
  /** A shell or app on this Mac: the existing Terminal setting decides alone. */
  | 'local'
  /** An interactive shell on a cloud sandbox or SSH host. */
  | 'remote-shell'
  /** An agent TUI on a cloud sandbox or SSH host. */
  | 'remote-agent'
  /** A Setup, Run or action log from a cloud sandbox or SSH host. */
  | 'remote-stream'

export type Osc52RemoteVerdict = 'allow' | 'refuse-source' | 'refuse-size' | 'refuse-idle'

/** Decoded UTF-8 bytes one remote copy may put on the Mac clipboard. */
export const REMOTE_OSC52_MAX_TEXT_BYTES = 100 * 1024

/**
 * A copy from tmux copy-mode or vim follows a keypress in that pane. Without one, the bytes come
 * from something printing on its own (a dev server, `tail -f`, `cat` of a file, an agent started
 * by hand without status hooks), which must not reach the Mac clipboard.
 */
export const REMOTE_OSC52_TYPED_WITHIN_MS = 3_000

export function resolveOsc52PaneSource(input: {
  remote: boolean
  /** A dock tab owned by a remote workspace: its Setup, Run or an action's log. */
  remoteDockStream: boolean
  /** The tab was launched as an agent, or an agent reports status from this pane. */
  agent: boolean
}): Osc52PaneSource {
  if (input.remoteDockStream) {
    return 'remote-stream'
  }
  if (!input.remote) {
    return 'local'
  }
  return input.agent ? 'remote-agent' : 'remote-shell'
}

export function decideRemoteOsc52Write(
  source: Exclude<Osc52PaneSource, 'local'>,
  text: string,
  /** Milliseconds since the person last typed into this pane; Infinity when never. */
  sinceTypedMs: number
): Osc52RemoteVerdict {
  if (source !== 'remote-shell') {
    return 'refuse-source'
  }
  if (!(sinceTypedMs >= 0 && sinceTypedMs <= REMOTE_OSC52_TYPED_WITHIN_MS)) {
    return 'refuse-idle'
  }
  return new TextEncoder().encode(text).byteLength > REMOTE_OSC52_MAX_TEXT_BYTES
    ? 'refuse-size'
    : 'allow'
}

/**
 * Remote text pasted into another app (Terminal.app, a browser, Slack) gets no bracketed-paste
 * protection, so control characters other than newline and tab are dropped, CRLF included as LF.
 */
export function sanitizeRemoteOsc52Text(text: string): string {
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point
  return text.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
}
