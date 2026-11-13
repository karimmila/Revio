import { rmdir } from 'node:fs/promises'
import { posix, win32 } from 'node:path'
import { isWindowsAbsolutePathLike } from '../../../../shared/cross-platform-path'
import { WORKTREE_CREATE_PREPARATION_DIRECTORY } from '../../../../shared/worktree/create-preparation'
import { toHostFilesystemPath } from '../../../filesystem/host-tree-removal'

/**
 * The folder prepared checkouts wait in goes with the last of them; it stayed, empty, in the
 * workspaces folder after every quit. `rmdir` refuses a folder that still holds a checkout, and
 * a preparation that starts at the same moment makes its own folder again.
 */
export async function removeEmptyPreparationRoot(
  preparedPath: string,
  remove: (path: string) => Promise<void> = rmdir
): Promise<void> {
  const paths = isWindowsAbsolutePathLike(preparedPath) ? win32 : posix
  const root = paths.dirname(preparedPath)
  if (paths.basename(root) !== WORKTREE_CREATE_PREPARATION_DIRECTORY) {
    return
  }
  try {
    await remove(toHostFilesystemPath(root))
  } catch {
    // It still holds a checkout, or it is already gone.
  }
}
