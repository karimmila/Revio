import {
  decideRemoteOsc52Write,
  sanitizeRemoteOsc52Text,
  type Osc52RemoteVerdict
} from './osc52-remote-policy'
import type { Osc52PaneOrigin } from './osc52-pane-source'

export type Osc52RemoteNotices = {
  copied: (text: string, cloud: boolean) => void
  refused: (verdict: Exclude<Osc52RemoteVerdict, 'allow'>, cloud: boolean) => void
}

/** Applies the remote policy to one coalesced OSC 52 write; local panes pass straight through. */
export function writeOsc52ForOrigin(
  text: string,
  origin: Osc52PaneOrigin,
  write: (text: string) => Promise<void>,
  notices: Osc52RemoteNotices
): Promise<void> {
  if (origin.source === 'local') {
    return write(text)
  }
  const clean = sanitizeRemoteOsc52Text(text)
  const verdict = decideRemoteOsc52Write(origin.source, clean, origin.sinceTypedMs)
  if (verdict !== 'allow') {
    notices.refused(verdict, origin.cloud)
    return Promise.resolve()
  }
  // Announce only a copy that landed, so the toast never claims text the clipboard refused.
  return write(clean).then(() => notices.copied(clean, origin.cloud))
}
