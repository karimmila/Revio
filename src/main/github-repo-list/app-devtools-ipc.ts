import { BrowserWindow, ipcMain } from 'electron'

/**
 * Help > Open debug tools in the workspace layout: the app window's own developer tools.
 * Why gated: in a packaged build DevTools can read every token and session in the window, so it
 * needs the explicit Advanced setting; dev builds keep it on.
 */
export function registerAppDevToolsHandler(deps: {
  isPackaged: () => boolean
  debugToolsEnabled: () => boolean
}): void {
  ipcMain.handle('revioApp:toggleDevTools', (event) => {
    if (!isAppDevToolsAllowed(deps)) {
      return
    }
    BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools()
  })
}

export function isAppDevToolsAllowed(deps: {
  isPackaged: () => boolean
  debugToolsEnabled: () => boolean
}): boolean {
  return !deps.isPackaged() || deps.debugToolsEnabled()
}
