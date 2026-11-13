import type { WebContents } from 'electron'
import { redactEphemeralVmRecipeDiagnosticText } from '../../shared/ephemeral-vm-recipe-diagnostics'

/** Streams a provision's output to the window that asked for it; nothing without a provision id. */
export function provisionEventSender(
  event: { sender: Pick<WebContents, 'send'> } | null | undefined,
  provisionId: string | undefined
): (stream: 'stdout' | 'stderr', chunk: string) => void {
  return (stream, chunk) => {
    // Read the sender only when there is something to send: callers without a window pass no event.
    if (!provisionId || !event) {
      return
    }
    event.sender.send('ephemeralVm:provisionEvent', {
      provisionId,
      stream,
      chunk: redactEphemeralVmRecipeDiagnosticText(chunk)
    })
  }
}
