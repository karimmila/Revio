import { app, type App } from 'electron'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/*
 * Electron names the macOS safeStorage Keychain item "<app name> Safe Storage" and fixes it
 * before ready. Without this, a packaged fork inherits package.json's `name` ("orca") and asks
 * for the real Orca app's Keychain key. electron-builder also stamps productName into the
 * packaged package.json; this covers builds that skip that config.
 *
 * Must stay the first import of src/main/index.ts: any earlier import may read app paths,
 * the Keychain or the logs folder under the old name. Dev keeps "Orca Dev" (set in preflight)
 * so the existing dev profile and its Keychain key stay valid.
 */
export function applyPackagedAppName(target: Pick<App, 'isPackaged' | 'setName'>): void {
  if (target.isPackaged) {
    target.setName(FORK_PRODUCT_NAME)
  }
}

applyPackagedAppName(app)
