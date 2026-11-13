import { ipcRenderer } from 'electron'

export type SupportApi = {
  /** Opens the new-issue page, prefilled with the app and OS versions; false when the build has no tracker. */
  openIssueReport: () => Promise<boolean>
  /** Reveals the folder that holds this app's log files. */
  openLogsFolder: () => Promise<void>
}

export const supportApi: SupportApi = {
  openIssueReport: () => ipcRenderer.invoke('support:openIssueReport'),
  openLogsFolder: () => ipcRenderer.invoke('support:openLogsFolder')
}
