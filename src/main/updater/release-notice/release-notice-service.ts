import { BrowserWindow, app, dialog, ipcMain, net, shell } from 'electron'
import { translateMain } from '../../i18n/main-i18n'
import {
  releaseNoticeRepo,
  releasesPageUrl,
  type ReleaseNotice
} from '../../../shared/release-notice'
import { isAppUpdaterEnabled } from '../../../shared/update-feed'
import {
  checkLatestRelease,
  isReleaseNoticeCheckDue,
  readReleaseNotice,
  releaseNoticeStateFilePath,
  skipReleaseNoticeVersion,
  type ReleaseNoticeCheckDeps,
  type ReleaseNoticeCheckResult
} from './release-notice-check'

const DUE_POLL_INTERVAL_MS = 60 * 60_000

let deps: ReleaseNoticeCheckDeps | null = null
let notice: ReleaseNotice | null = null
/** "Later" hides this version until the next daily check or the next launch. */
let laterVersion: string | null = null
let dueTimer: ReturnType<typeof setInterval> | null = null

function visibleNotice(): ReleaseNotice | null {
  return notice && notice.version !== laterVersion ? notice : null
}

let lastSentVersion: string | null = null

function broadcast(): void {
  const visible = visibleNotice()
  if ((visible?.version ?? null) === lastSentVersion) {
    return
  }
  lastSentVersion = visible?.version ?? null
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('releaseNotice:changed', visible)
    }
  }
}

function buildDeps(repo: string): ReleaseNoticeCheckDeps {
  return {
    repo,
    currentVersion: app.getVersion(),
    stateFilePath: releaseNoticeStateFilePath(app.getPath('userData')),
    fetch: (url, init) => net.fetch(url, init)
  }
}

async function runCheck(): Promise<ReleaseNoticeCheckResult> {
  if (!deps) {
    return { notice: null, answered: false }
  }
  const result = await checkLatestRelease(deps)
  notice = result.notice
  broadcast()
  return result
}

/** What the dialog says when the check found no newer release. */
function releaseCheckAnswer(
  answered: boolean,
  noRelease: true | undefined
): { message: string; detail: string } {
  const version = app.getVersion()
  if (answered) {
    return {
      message: translateMain('releaseNotice.upToDate.title', '{{productName}} is up to date'),
      detail: translateMain('releaseNotice.upToDate.detail', 'Version {{version}} is the latest.', {
        version
      })
    }
  }
  if (noRelease) {
    // A 404 is an answer about the releases, so "check your connection" would send people the
    // wrong way.
    return {
      message: translateMain('releaseNotice.noRelease.title', 'No release found yet'),
      detail: translateMain('releaseNotice.noRelease.detail', 'You have version {{version}}.', {
        version
      })
    }
  }
  return {
    message: translateMain('releaseNotice.checkFailed.title', 'Could not check for a new version'),
    detail: translateMain(
      'releaseNotice.checkFailed.detail',
      'GitHub did not answer. Check your connection and try again.'
    )
  }
}

/**
 * The app menu's "Check for Updates...": shows the notice card when a newer release exists, and
 * says so in a dialog when there is none or GitHub did not answer.
 */
export async function runUserInitiatedReleaseCheck(parent: BrowserWindow | null): Promise<void> {
  const repo = releaseNoticeRepo()
  if (!repo) {
    return
  }
  deps ??= buildDeps(repo)
  laterVersion = null
  const { notice: found, answered, noRelease } = await runCheck()
  if (found) {
    return
  }
  const options: Electron.MessageBoxOptions = {
    type: 'info',
    ...releaseCheckAnswer(answered, noRelease)
  }
  await (parent && !parent.isDestroyed()
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options))
}

export function registerReleaseNoticeHandlers(): void {
  ipcMain.handle('releaseNotice:get', () => visibleNotice())
  ipcMain.handle('releaseNotice:later', () => {
    laterVersion = notice?.version ?? null
    broadcast()
  })
  ipcMain.handle('releaseNotice:skip', () => {
    if (deps && notice) {
      skipReleaseNoticeVersion(deps, notice.version)
    }
    notice = null
    broadcast()
  })
  ipcMain.handle('releaseNotice:check', (event) =>
    runUserInitiatedReleaseCheck(BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle('releaseNotice:openReleases', async () => {
    const repo = releaseNoticeRepo()
    if (repo) {
      await shell.openExternal(releasesPageUrl(repo))
    }
  })
  ipcMain.handle('releaseNotice:download', async () => {
    // The page URL is built in main from releasesRepo; the renderer never supplies one.
    if (notice) {
      await shell.openExternal(notice.url)
    }
  })
}

/**
 * Starts the daily "new version available" check. A no-op in dev builds (unless
 * REVIO_RELEASE_NOTICE_IN_DEV=1), when the build names no releasesRepo, and when the real updater
 * is on (it has its own card).
 */
export function startReleaseNoticeChecks(): void {
  const repo = releaseNoticeRepo()
  const runsHere = app.isPackaged || process.env.REVIO_RELEASE_NOTICE_IN_DEV === '1'
  if (!repo || isAppUpdaterEnabled() || !runsHere || dueTimer) {
    return
  }
  deps = buildDeps(repo)
  notice = readReleaseNotice(deps)
  broadcast()
  void runCheck()
  dueTimer = setInterval(() => {
    if (deps && isReleaseNoticeCheckDue(deps)) {
      laterVersion = null
      void runCheck()
    }
  }, DUE_POLL_INTERVAL_MS)
  dueTimer.unref?.()
}
