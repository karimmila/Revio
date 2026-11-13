import { BrowserWindow, ipcMain } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { writeSecureFile } from '../../shared/secure-file'
import { formatSharedActions, sharedActionsFileFor } from '../../shared/actions/repo-actions'
import type { Repo } from '../../shared/repo-types'
import { getSetupEnvVars } from '../workspace-hooks/setup-hook-env-vars'
import { listGitRemotes } from '../git/pinned-remote'
import { previewWorktreeIncludePaths } from '../git/worktrees/content-paths/worktree-include-file'
import {
  ActionSchema,
  personalFile,
  PreviewUrlsSchema,
  readPersonal,
  readRepoActions,
  RunModeSchema,
  type RepoActionsList
} from './repo-actions-store'

export type { RepoActionsList }

/**
 * A repository's actions: shared ones from its actions file (committed by the person, read
 * and written here only when they edit them), then personal ones kept in Orca's data folder.
 */
export function registerRepoActionsHandlers(getRepos: () => Repo[]): void {
  const repoOf = (repoId: unknown): Repo => {
    const repo = getRepos().find((candidate) => candidate.id === repoId)
    if (!repo) {
      throw new Error('Unknown repository')
    }
    return repo
  }
  ipcMain.handle('actions:list', (_event, repoId: unknown): RepoActionsList =>
    readRepoActions(repoOf(repoId))
  )
  ipcMain.handle('repos:listRemotes', (_event, repoId: unknown) =>
    listGitRemotes(repoOf(repoId).path)
  )
  ipcMain.handle('repos:filesToCopyPreview', (_event, repoId: unknown, patterns: unknown) =>
    previewWorktreeIncludePaths(
      repoOf(repoId).path,
      z.array(z.string().min(1).max(4096)).max(1000).parse(patterns)
    )
  )
  // Run actions see the same script environment as setup: ORCA_PORT, ORCA_WORKSPACE_PATH, …
  ipcMain.handle('actions:scriptEnv', (_event, repoId: unknown, worktreePath: unknown) => {
    const repo = repoOf(repoId)
    return getSetupEnvVars(repo, z.string().min(1).max(4096).parse(worktreePath))
  })
  ipcMain.handle(
    'actions:save',
    (_event, repoId: unknown, actions: unknown, runMode: unknown, previewUrls: unknown) => {
      const repo = repoOf(repoId)
      const list = z.array(ActionSchema).max(200).parse(actions)
      const previous = readPersonal(repo.id)
      const mode = RunModeSchema.optional().parse(runMode) ?? previous.runMode
      const urls = PreviewUrlsSchema.optional().parse(previewUrls) ?? previous.previewUrls
      writeSecureFile(
        personalFile(repo.id),
        `${JSON.stringify(
          { actions: list.filter((action) => !action.shared), runMode: mode, previewUrls: urls },
          null,
          2
        )}\n`
      )
      const shared = list.filter((action) => action.shared)
      const sharedFile = join(
        repo.path,
        sharedActionsFileFor((file) => existsSync(join(repo.path, file)))
      )
      if (shared.length > 0 || existsSync(sharedFile)) {
        mkdirSync(dirname(sharedFile), { recursive: true })
        writeFileSync(sharedFile, formatSharedActions(shared))
      }
      // Run buttons reload their menu from this, so an edit shows without switching workspace.
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('actions:changed', { repoId: repo.id })
        }
      }
    }
  )
}
