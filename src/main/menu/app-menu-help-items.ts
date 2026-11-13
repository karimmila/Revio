import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { translateMain } from '../i18n/main-i18n'
import { forkServiceUrl } from '../../shared/fork-services'
import { issueReportUrl } from '../../shared/issue-report-url'
import { releaseNoticeRepo } from '../../shared/release-notice'
import { getLogsDirectory } from '../observability/logs-directory'
import { runUserInitiatedReleaseCheck } from '../updater/release-notice/release-notice-service'

/** Opens the fork's new-issue page in the browser, prefilled with versions. Sends nothing itself. */
export async function openIssueReport(): Promise<boolean> {
  const issuesUrl = forkServiceUrl('issuesUrl')
  if (!issuesUrl) {
    return false
  }
  await shell.openExternal(
    issueReportUrl(issuesUrl, {
      appVersion: app.getVersion(),
      platform: process.platform,
      osVersion: process.getSystemVersion?.() ?? '',
      arch: process.arch
    })
  )
  return true
}

/** Reveals the folder that holds this app's log files, creating it on a profile that never logged. */
export async function openLogsFolder(): Promise<void> {
  const directory = getLogsDirectory()
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
  } catch {
    // openPath reports the missing folder itself.
  }
  await shell.openPath(directory)
}

export function registerSupportHandlers(): void {
  ipcMain.handle('support:openIssueReport', () => openIssueReport())
  ipcMain.handle('support:openLogsFolder', () => openLogsFolder())
}

/** "Report an Issue" and "Open Logs Folder", for the Help menu. */
export function createHelpSupportItems(): Electron.MenuItemConstructorOptions[] {
  const items: Electron.MenuItemConstructorOptions[] = []
  if (forkServiceUrl('issuesUrl')) {
    items.push({
      label: translateMain('menu.reportIssue', 'Report an Issue...'),
      click: () => void openIssueReport().catch(() => undefined)
    })
  }
  items.push({
    label: translateMain('menu.openLogsFolder', 'Open Logs Folder'),
    click: () => void openLogsFolder().catch(() => undefined)
  })
  return items
}

/**
 * "Check for Updates..." for a build without the self-updater: it asks the public releases page
 * and never installs. Null when the build names no releasesRepo.
 */
export function createReleaseCheckItem(): Electron.MenuItemConstructorOptions | null {
  if (!releaseNoticeRepo()) {
    return null
  }
  return {
    label: translateMain('menu.checkForUpdates', 'Check for Updates...'),
    click: (_menuItem, window) =>
      void runUserInitiatedReleaseCheck(window instanceof BrowserWindow ? window : null).catch(
        () => undefined
      )
  }
}
