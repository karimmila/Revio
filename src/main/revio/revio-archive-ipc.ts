import { app, ipcMain } from 'electron'
import { z } from 'zod'
import {
  ArchivedWorkspaceSchema,
  addArchivedWorkspace,
  readArchivedWorkspaces,
  removeArchivedWorkspace
} from './revio-archive-store'
import type { ArchivedWorkspace } from '../../shared/revio-archive-types'
import { releaseRestorePoint } from '../cloud/cloud-archive-restore'
import { deleteArchivedWorkspaceForGood, type ArchiveRepoGit } from './revio-archive-delete'

export type { ArchiveRepoGit }

/** A cloud record's restore snapshot goes with the record; one still named by a kept record stays. */
function releaseDroppedRestorePoints(userDataPath: string, dropped: ArchivedWorkspace[]): void {
  const stillNamed = new Set(
    readArchivedWorkspaces(userDataPath).map((entry) => entry.cloudRestore?.snapshotId)
  )
  for (const record of dropped) {
    const snapshotId = record.cloudRestore?.snapshotId
    if (snapshotId && !stillNamed.has(snapshotId)) {
      void releaseRestorePoint(snapshotId).catch((error: unknown) => {
        console.warn('[revio-archive] Could not delete a restore snapshot:', error)
      })
    }
  }
}

const WorkspaceIdSchema = z.string().min(1).max(4096)

export function registerRevioArchiveHandlers(repoGit: ArchiveRepoGit): void {
  const userData = (): string => app.getPath('userData')
  ipcMain.handle('revioArchive:list', () => readArchivedWorkspaces(userData()))
  ipcMain.handle('revioArchive:add', (_event, record: unknown) => {
    releaseDroppedRestorePoints(
      userData(),
      addArchivedWorkspace(userData(), ArchivedWorkspaceSchema.parse(record))
    )
  })
  // Unarchive: the record goes, and its checkpoint sessions wait for the workspace's next archive.
  ipcMain.handle('revioArchive:remove', (_event, id: unknown, unarchivedAs: unknown) => {
    const recordId = WorkspaceIdSchema.parse(id)
    releaseDroppedRestorePoints(
      userData(),
      removeArchivedWorkspace(
        userData(),
        recordId,
        WorkspaceIdSchema.nullish().parse(unarchivedAs) ?? recordId
      )
    )
  })
  ipcMain.handle('revioArchive:delete', async (_event, id: unknown) => {
    releaseDroppedRestorePoints(
      userData(),
      await deleteArchivedWorkspaceForGood(userData(), WorkspaceIdSchema.parse(id), repoGit)
    )
  })
}
