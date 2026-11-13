import { app, ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type {
  WorkspaceImportDetection,
  WorkspaceImportPreparation,
  WorkspaceImportResult
} from '../../shared/workspace-import-types'
import { workspaceImportGit } from './workspace-import-git'
import { isImportSourcePresent } from './import-source-database'
import { readAsleepCloudWorkspaces } from './asleep-cloud-store'
import { finishAsleepCloudWake, prepareAsleepCloudWake } from './asleep-cloud-wake'
import { detectWorkspaceImport, prepareWorkspaceImport } from './workspace-import-detect'
import { runWorkspaceImport, type WorkspaceImportServiceDeps } from './workspace-import-service'

const IdSchema = z.string().min(1).max(64)

const OptionsSchema = z.object({
  includeArchived: z.boolean(),
  includeScripts: z.boolean(),
  approvedScriptHashes: z
    .array(z.string().regex(/^[0-9a-f]{64}$/))
    .max(200)
    .optional()
})

let running: Promise<WorkspaceImportResult> | null = null

/** Detect and run the import of another app's workspaces and chats; one run at a time. */
export function registerWorkspaceImportHandlers(
  mainWindow: BrowserWindow,
  store: Store,
  runtime: OrcaRuntimeService
): void {
  const deps: WorkspaceImportServiceDeps = {
    store,
    mainWindow,
    runtime,
    git: workspaceImportGit,
    userDataDir: app.getPath('userData')
  }
  ipcMain.removeHandler('workspaceImport:available')
  ipcMain.handle('workspaceImport:available', () => isImportSourcePresent())
  ipcMain.removeHandler('workspaceImport:detect')
  ipcMain.removeHandler('workspaceImport:prepare')
  ipcMain.removeHandler('workspaceImport:run')
  ipcMain.handle('workspaceImport:detect', (): WorkspaceImportDetection => {
    try {
      return detectWorkspaceImport(deps.userDataDir)
    } catch {
      return { found: false }
    }
  })
  // Only ever called after the person presses Import: this is the first read of their folders.
  ipcMain.handle('workspaceImport:prepare', async (): Promise<WorkspaceImportPreparation> => {
    try {
      return await prepareWorkspaceImport(deps.userDataDir)
    } catch {
      return { repositoryScripts: [] }
    }
  })
  ipcMain.handle('workspaceImport:run', (_event, rawOptions: unknown) => {
    const options = OptionsSchema.parse(rawOptions)
    running ??= runWorkspaceImport(deps, options, (progress) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workspaceImport:progress', progress)
      }
    }).finally(() => {
      running = null
      asleepChanged()
    })
    return running
  })
  const asleepChanged = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workspaceImport:asleepChanged')
    }
  }
  for (const channel of ['asleepList', 'prepareWake', 'finishWake']) {
    ipcMain.removeHandler(`workspaceImport:${channel}`)
  }
  ipcMain.handle('workspaceImport:asleepList', () => readAsleepCloudWorkspaces(deps.userDataDir))
  ipcMain.handle('workspaceImport:prepareWake', (_event, id: unknown) =>
    prepareAsleepCloudWake(deps.userDataDir, IdSchema.parse(id))
  )
  ipcMain.handle('workspaceImport:finishWake', (_event, id: unknown) => {
    const changes = finishAsleepCloudWake(deps.userDataDir, IdSchema.parse(id))
    if (changes !== null) {
      asleepChanged()
    }
    return changes
  })
}
