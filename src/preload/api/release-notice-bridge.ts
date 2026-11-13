import { ipcRenderer } from 'electron'
import type { ReleaseNotice } from '../../shared/release-notice'

export type ReleaseNoticeApi = {
  /** The newer release to tell the person about; null when there is none or they hid it. */
  get: () => Promise<ReleaseNotice | null>
  /** Hide until the next daily check or the next launch. */
  later: () => Promise<void>
  /** Never show this version again; a later release still shows. */
  skip: () => Promise<void>
  /** Open the release page in the default browser. */
  download: () => Promise<void>
  /** Ask now: shows the card when a newer release exists, else a dialog that says so. */
  check: () => Promise<void>
  /** Open the page that lists every release. */
  openReleases: () => Promise<void>
  onChanged: (callback: (notice: ReleaseNotice | null) => void) => () => void
}

export const releaseNoticeApi: ReleaseNoticeApi = {
  get: () => ipcRenderer.invoke('releaseNotice:get'),
  later: () => ipcRenderer.invoke('releaseNotice:later'),
  skip: () => ipcRenderer.invoke('releaseNotice:skip'),
  download: () => ipcRenderer.invoke('releaseNotice:download'),
  check: () => ipcRenderer.invoke('releaseNotice:check'),
  openReleases: () => ipcRenderer.invoke('releaseNotice:openReleases'),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, notice: ReleaseNotice | null): void =>
      callback(notice)
    ipcRenderer.on('releaseNotice:changed', listener)
    return () => ipcRenderer.removeListener('releaseNotice:changed', listener)
  }
}
