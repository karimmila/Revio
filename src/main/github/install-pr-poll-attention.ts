import { BrowserWindow, powerMonitor } from 'electron'
import { resolvePrPollAttention, setPrPollAttentionSource } from './pr-poll-attention'

/** Matches the idle window "Restart when idle" uses: five minutes without input means away. */
const PR_POLL_IDLE_SECONDS = 5 * 60

/** Read at each scheduling decision, so no timer or event listener is needed. */
export function installPrPollAttention(): void {
  setPrPollAttentionSource(() => {
    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed())
    return resolvePrPollAttention({
      idleState: powerMonitor.getSystemIdleState(PR_POLL_IDLE_SECONDS),
      anyWindowVisible: windows.some((window) => window.isVisible() && !window.isMinimized()),
      anyWindowFocused: BrowserWindow.getFocusedWindow() !== null
    })
  })
}
