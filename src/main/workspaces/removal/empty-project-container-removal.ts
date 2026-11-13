import { rmdir } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

/**
 * Workspaces of one project sit together in `<workspace folder>/<project name>/`. When the last
 * one is deleted that folder stays behind, empty. It is removed, and only it: the folder must be
 * named after the project (the name the app gave it), must not be the project itself, and
 * `rmdir` refuses a folder that still holds anything.
 */
export async function removeEmptyProjectContainer(
  worktreePath: string,
  repoPath: string
): Promise<boolean> {
  const container = dirname(resolve(worktreePath))
  const projectName = basename(resolve(repoPath)).replace(/\.git$/, '')
  if (
    projectName === '' ||
    basename(container) !== projectName ||
    container === resolve(repoPath) ||
    container === dirname(container)
  ) {
    return false
  }
  try {
    await rmdir(container)
    return true
  } catch {
    // Not empty, already gone, or not ours to remove: all are fine.
    return false
  }
}
