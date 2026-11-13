import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { git } from './workspace-import-git'

/** The source app's own scratch folder in each workspace; it is not part of the work. */
const SKIPPED_UNTRACKED_PREFIXES = ['.context/']
const MAX_UNTRACKED_FILE_BYTES = 50 * 1024 * 1024
export const IMPORT_LEFTOVERS_FOLDER = '.revio-import'

export type MirrorChanges = {
  head: string
  patch: string
  untracked: string[]
}

/**
 * The mirror's files, and maybe its git config, came from a cloud sandbox where agents ran, so git
 * must not start the programs that config can name: a filesystem monitor, hooks, or a textconv.
 */
const UNTRUSTED_REPO_CONFIG = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null']

/**
 * True for a regular file of an importable size. A symlink is never followed: one left in the
 * sandbox could point at a key or token on this Mac, and its target would be copied into the
 * worktree and uploaded to the next sandbox.
 */
export async function isImportableMirrorFile(
  mirrorPath: string,
  relativePath: string
): Promise<boolean> {
  try {
    const stats = await lstat(join(mirrorPath, relativePath))
    return stats.isFile() && stats.size <= MAX_UNTRACKED_FILE_BYTES
  } catch {
    return false
  }
}

/** Reads what the mirror has on top of its commit; the mirror itself is never written. */
export async function readMirrorChanges(mirrorPath: string): Promise<MirrorChanges> {
  const head = (await git(mirrorPath, [...UNTRUSTED_REPO_CONFIG, 'rev-parse', 'HEAD'])).trim()
  const patch = await git(mirrorPath, [
    ...UNTRUSTED_REPO_CONFIG,
    'diff',
    '--binary',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    'HEAD'
  ])
  const listed = await git(mirrorPath, [
    ...UNTRUSTED_REPO_CONFIG,
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z'
  ])
  const untracked: string[] = []
  for (const path of listed.split('\0')) {
    const wanted =
      path !== '' && !SKIPPED_UNTRACKED_PREFIXES.some((prefix) => path.startsWith(prefix))
    if (wanted && (await isImportableMirrorFile(mirrorPath, path))) {
      untracked.push(path)
    }
  }
  return { head, patch, untracked }
}

/** Makes the mirror's commit reachable from the project clone; returns false when it cannot. */
export async function fetchMirrorCommit(
  repoPath: string,
  mirrorPath: string,
  commit: string
): Promise<boolean> {
  const present = async (): Promise<boolean> => {
    try {
      await git(repoPath, ['cat-file', '-e', `${commit}^{commit}`])
      return true
    } catch {
      return false
    }
  }
  if (await present()) {
    return true
  }
  try {
    await git(repoPath, ['fetch', '--no-tags', '--no-write-fetch-head', mirrorPath, 'HEAD'])
  } catch {
    return false
  }
  return present()
}

async function copyInto(
  sourceRoot: string,
  targetRoot: string,
  relativePath: string
): Promise<void> {
  const target = join(targetRoot, relativePath)
  // Checked again at the copy: the list was read earlier, and a symlink must never be followed.
  if (!(await isImportableMirrorFile(sourceRoot, relativePath))) {
    return
  }
  await mkdir(dirname(target), { recursive: true })
  try {
    await copyFile(join(sourceRoot, relativePath), target, constants.COPYFILE_EXCL)
  } catch (error) {
    // A file already at the target is the worktree's own and is kept as it is.
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
}

export type AppliedChanges = 'none' | 'applied' | 'kept-aside'

/**
 * Brings the mirror's uncommitted work into the new worktree. A patch that does not apply is kept,
 * with the new files, in a folder of its own so nothing is lost or half-applied.
 */
export async function applyMirrorChanges(
  worktreePath: string,
  mirrorPath: string,
  changes: MirrorChanges
): Promise<AppliedChanges> {
  if (changes.patch === '' && changes.untracked.length === 0) {
    return 'none'
  }
  let patchApplied = changes.patch === ''
  if (!patchApplied) {
    try {
      await git(worktreePath, ['apply', '--binary', '--whitespace=nowarn', '-'], changes.patch)
      patchApplied = true
    } catch {
      patchApplied = false
    }
  }
  if (patchApplied) {
    for (const path of changes.untracked) {
      await copyInto(mirrorPath, worktreePath, path)
    }
    return 'applied'
  }
  const aside = join(worktreePath, IMPORT_LEFTOVERS_FOLDER)
  await mkdir(aside, { recursive: true })
  await writeFile(join(aside, '.gitignore'), '*\n')
  await writeFile(join(aside, 'uncommitted-changes.patch'), changes.patch)
  for (const path of changes.untracked) {
    await copyInto(mirrorPath, join(aside, 'new-files'), path)
  }
  return 'kept-aside'
}
