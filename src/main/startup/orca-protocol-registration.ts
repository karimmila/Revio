import type { App } from 'electron'
import { FORK_URL_SCHEME } from '../../shared/fork-identity'

/**
 * Registers the fork's own scheme (never upstream's `orca://`) with Windows, which NSIS installs leave unregistered; macOS reads it from
 * Info.plist and Linux packages from the desktop entry. Only packaged desktop launches register,
 * so dev, test and serve runs never take over the machine's handler.
 */
export function registerOrcaProtocolClient(
  app: Pick<App, 'isPackaged' | 'isDefaultProtocolClient' | 'setAsDefaultProtocolClient'>,
  options: { platform: NodeJS.Platform; desktopLaunch: boolean }
): boolean {
  if (options.platform !== 'win32' || !app.isPackaged || !options.desktopLaunch) {
    return false
  }
  if (app.isDefaultProtocolClient(FORK_URL_SCHEME)) {
    return false
  }
  try {
    return app.setAsDefaultProtocolClient(FORK_URL_SCHEME)
  } catch (error) {
    console.warn(`[protocol] Failed to register ${FORK_URL_SCHEME}:// links:`, error)
    return false
  }
}
