import { app, BrowserWindow, dialog, powerMonitor } from 'electron'
import {
  disconnectDaemon,
  getDaemonProvider,
  shutdownDaemon
} from '../daemon/providers/lifecycle/daemon-provider-state'
import { isQuittingForUpdate } from '../updater/updater-service'
import { isDevParentShutdownRequested } from './configure-process'
import { mainProcessState as state } from './main-process-state'
import { cloudDataRoot } from '../cloud/cloud-repo-store'
import { createProcessQuitEscalation } from './process-quit-escalation'
import { ownCloudDockTerminalIds } from './quit-own-terminal-programs'
import { isProcessQuitRequested, markProcessQuitRequested } from './process-quit-request'
import { quitTeardownStartGate } from './quit/quit-teardown-start-gate'
import {
  confirmQuitWithBusyTerminals,
  countBusyTerminals,
  createQuitTerminalGuard,
  stopsTerminalsOnQuit
} from './quit-terminal-policy'
import { registerServeSignalHandlers } from './serve-signal-handlers'

// Long enough for a local daemon to answer, short enough that Quit never feels held.
const BUSY_TERMINAL_COUNT_TIMEOUT_MS = 1500

/** Whether this quit ends the terminal service, read when the quit is committed. */
export function quitStopsTerminals(quittingForUpdate: boolean): boolean {
  return stopsTerminalsOnQuit(state.store?.getSettings(), {
    isServeMode: state.isServeMode,
    quittingForUpdate
  })
}

let openQuitQuestion: AbortController | null = null

function closeQuitQuestion(): void {
  openQuitQuestion?.abort()
}

function askAboutBusyTerminals(busy: number): Promise<boolean> {
  const question = new AbortController()
  openQuitQuestion = question
  return confirmQuitWithBusyTerminals(
    busy,
    (options) => {
      const window =
        state.mainWindow && !state.mainWindow.isDestroyed() ? state.mainWindow : undefined
      return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
    },
    question.signal
  ).finally(() => {
    if (openQuitQuestion === question) {
      openQuitQuestion = null
    }
  })
}

function installProcessQuitSignals(): void {
  // A serve host registers its own signal handling, and its Quit never asks.
  if (state.isServeMode) {
    return
  }
  // After ready, and by re-adding every listener: Electron takes SIGTERM, SIGINT and SIGHUP for
  // itself during startup. Its handler quits without marking the quit, so the question would
  // hold a signal, and it handles one signal only: the next one kills the process with the
  // terminal service and every shell still running.
  registerServeSignalHandlers(
    process,
    createProcessQuitEscalation({
      markRequested: markProcessQuitRequested,
      closeQuitQuestion,
      quit: () => app.quit(),
      teardownStarted: () => quitTeardownStartGate.hasStarted(),
      destroyWindows: () => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (!window.isDestroyed()) {
            window.destroy()
          }
        }
      },
      stopTerminalService: () =>
        isDevParentShutdownRequested() || quitStopsTerminals(isQuittingForUpdate())
          ? shutdownDaemon()
          : disconnectDaemon(),
      exit: () => app.exit(0)
    })
  )
}

/**
 * Before every other `before-quit` listener, so a cancelled Quit starts no teardown. A signal,
 * logout or shutdown quits without a question, and closes one that is already open: nobody is
 * there to answer it, and an unanswered dialog would hold the shutdown.
 */
export function installQuitTerminalGuard(): void {
  // powerMonitor is only safe once the app is ready.
  void app.whenReady().then(() => {
    powerMonitor.on('shutdown', () => {
      markProcessQuitRequested()
      // The guard takes the closed question as a confirmed Quit, so the system need not wait.
      closeQuitQuestion()
    })
    installProcessQuitSignals()
  })
  app.prependListener(
    'before-quit',
    createQuitTerminalGuard({
      shouldAsk: () =>
        !isProcessQuitRequested() &&
        !isDevParentShutdownRequested() &&
        quitStopsTerminals(isQuittingForUpdate()),
      countBusy: () =>
        countBusyTerminals(getDaemonProvider(), BUSY_TERMINAL_COUNT_TIMEOUT_MS, (busy) =>
          ownCloudDockTerminalIds(busy, cloudDataRoot)
        ),
      confirm: askAboutBusyTerminals,
      quit: () => app.quit(),
      // Tray Quit marks the app as quitting before it asks; a cancelled Quit takes that back.
      cancelled: () => {
        state.isQuitting = false
      }
    })
  )
}
