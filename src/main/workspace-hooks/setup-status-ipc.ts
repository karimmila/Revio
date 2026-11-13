import { BrowserWindow, ipcMain } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { parseSetupStatus, type SetupStatus } from '../../shared/setup-status'
import { SETUP_STATUS_FILE } from './setup-runner-script-text'
import {
  SetupStatusMonitor,
  type SetupStatusEvent,
  type SetupStatusReading
} from './setup-status-monitor'

export const SETUP_STATUS_CHANGED_CHANNEL = 'setup:status-changed'
export const SETUP_FINISHED_CHANNEL = 'setup:finished'

function setupStatusFilePath(worktreePath: string): string {
  const dotGit = join(worktreePath, '.git')
  // A linked worktree's .git is a file naming its private git dir, where the runner lives.
  const gitdir = statSync(dotGit).isDirectory()
    ? dotGit
    : resolve(
        worktreePath,
        /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim() ?? ''
      )
  return join(gitdir, 'orca', SETUP_STATUS_FILE)
}

/** The setup status of a worktree on this Mac; null without a status file (no setup, or older runner). */
export function readSetupStatus(worktreePath: string): SetupStatus | null {
  return readSetupStatusReading(worktreePath)?.status ?? null
}

/** The status plus a run id (the file's mtime), so each finished run is acted on once. */
export function readSetupStatusReading(worktreePath: string): SetupStatusReading {
  try {
    const file = setupStatusFilePath(worktreePath)
    const status = parseSetupStatus(readFileSync(file, 'utf8'))
    return status ? { status, runId: String(statSync(file).mtimeMs) } : null
  } catch {
    return null
  }
}

function sendToWindows(event: SetupStatusEvent): void {
  const channel = event.kind === 'finished' ? SETUP_FINISHED_CHANNEL : SETUP_STATUS_CHANGED_CHANNEL
  const payload =
    event.kind === 'finished'
      ? { path: event.path, status: event.status, runId: event.runId }
      : { path: event.path, status: event.status }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}

const watchedSenders = new Set<number>()
const pathsSchema = z.array(z.string().min(1).max(4096)).max(500)

/**
 * Why main and not each window: every window used to poll every 2s and run Auto-run after setup
 * on its own, so two windows ran the default action twice. Main polls once and grants each
 * finished run to the first window that claims it.
 */
export function registerSetupStatusHandlers(
  monitor = new SetupStatusMonitor({ read: readSetupStatusReading, emit: sendToWindows })
): void {
  ipcMain.handle('setup:status', (_event, worktreePaths: unknown) => {
    const paths = pathsSchema.parse(worktreePaths)
    return Object.fromEntries(paths.map((path) => [path, readSetupStatus(path)]))
  })
  ipcMain.handle('setup:watch', (event, worktreePaths: unknown) => {
    const paths = pathsSchema.parse(worktreePaths)
    const sender = event.sender
    if (!watchedSenders.has(sender.id)) {
      watchedSenders.add(sender.id)
      sender.once('destroyed', () => {
        watchedSenders.delete(sender.id)
        monitor.unwatch(sender.id)
      })
    }
    return monitor.watch(sender.id, paths)
  })
  ipcMain.handle('setup:claimFinished', (_event, path: unknown, runId: unknown) =>
    monitor.claim(z.string().min(1).max(4096).parse(path), z.string().min(1).max(64).parse(runId))
  )
}
