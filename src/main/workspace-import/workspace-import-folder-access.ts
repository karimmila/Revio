import { readdir, stat } from 'node:fs/promises'

export type FolderAccess = 'ok' | 'missing' | 'denied'

/** macOS answers EPERM for a folder the person has not allowed (Desktop, Documents, a volume). */
export function isFolderAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const code = 'code' in error ? error.code : undefined
  if (code === 'EPERM' || code === 'EACCES') {
    return true
  }
  // git reports the same refusal only as text on stderr.
  const text = [
    'message' in error ? error.message : '',
    'stderr' in error ? error.stderr : ''
  ].join('\n')
  return /Operation not permitted|Permission denied/i.test(text)
}

/**
 * Asks for the folder's entries without blocking the main thread. The first read of a protected
 * folder makes macOS show its permission prompt, and the read only returns once the person has
 * answered; every later read, also a synchronous one, then gets that answer at once.
 */
export async function probeFolderAccess(path: string): Promise<FolderAccess> {
  try {
    await readdir(path)
    return 'ok'
  } catch (error) {
    return isFolderAccessDenied(error) ? 'denied' : 'missing'
  }
}

/** The first of the folders that macOS will not let the app read, or null when none is refused. */
export async function firstDeniedFolder(
  paths: readonly (string | null | undefined)[]
): Promise<string | null> {
  for (const path of new Set(paths)) {
    if (path && (await probeFolderAccess(path)) === 'denied') {
      return path
    }
  }
  return null
}

export async function isExistingDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
