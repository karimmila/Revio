import type { GlobalSettings } from '../../shared/global-settings-types'

const CHECK_INTERVAL_MS = 60_000
/**
 * Five minutes without keyboard or mouse input, the same window the workspace layout's "Restart
 * when idle" waits.
 */
const IDLE_SECONDS = 5 * 60

/**
 * Workspace layout's "Restart automatically on update": once an update has downloaded, install it
 * when no agent is working and the person has stepped away, so a restart never cuts a live turn.
 */
export function installRevioRestartWhenIdle(deps: {
  isUpdaterEnabled: () => boolean
  getSettings: () => Pick<GlobalSettings, 'revioLayout' | 'revioRestartOnUpdate'>
  getUpdateState: () => string
  getWorkingAgentCount: () => number
  getSystemIdleSeconds: () => number
  isQuitting: () => boolean
  quitAndInstall: () => void
}): () => void {
  // No feed means nothing of ours can be 'downloaded'; never poll, so no stale state can install.
  if (!deps.isUpdaterEnabled()) {
    return () => {}
  }
  const timer = setInterval(() => {
    const settings = deps.getSettings()
    if (
      deps.isUpdaterEnabled() &&
      settings.revioLayout === true &&
      settings.revioRestartOnUpdate === true &&
      !deps.isQuitting() &&
      deps.getUpdateState() === 'downloaded' &&
      deps.getWorkingAgentCount() === 0 &&
      deps.getSystemIdleSeconds() >= IDLE_SECONDS
    ) {
      clearInterval(timer)
      deps.quitAndInstall()
    }
  }, CHECK_INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}
