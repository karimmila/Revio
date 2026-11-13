import { app, dialog } from 'electron'
import { translateMain } from '../i18n/main-i18n'
import { forkServiceUrl } from '../../shared/fork-services'
import { openIssueReport, openLogsFolder } from '../menu/app-menu-help-items'

let shown = false

/**
 * Replaces Electron's "A JavaScript error occurred in the main process" box, which prints a raw
 * stack. The error is already in the log; this says so once per run and offers the ways forward.
 * Returns false before the app is ready, where no dialog can show, and in dev builds, where the
 * rethrow that shows the stack is what a developer wants: the default handling stays.
 */
export function showMainProcessErrorDialog(): boolean {
  if (!app.isPackaged || !app.isReady()) {
    return false
  }
  if (shown) {
    return true
  }
  shown = true
  const canReport = forkServiceUrl('issuesUrl') !== null
  const buttons = [
    translateMain('mainError.ok', 'OK'),
    translateMain('menu.openLogsFolder', 'Open Logs Folder'),
    ...(canReport ? [translateMain('menu.reportIssue', 'Report an Issue...')] : [])
  ]
  void dialog
    .showMessageBox({
      type: 'error',
      message: translateMain('mainError.title', '{{productName}} ran into a problem'),
      detail: translateMain(
        'mainError.detail',
        'The error was saved to the log. You can keep working. If something looks wrong, quit and reopen {{productName}}.'
      ),
      buttons,
      defaultId: 0,
      cancelId: 0
    })
    .then(({ response }) => {
      if (response === 1) {
        return openLogsFolder()
      }
      if (response === 2) {
        return openIssueReport().then(() => undefined)
      }
      return undefined
    })
    .catch(() => undefined)
  return true
}
