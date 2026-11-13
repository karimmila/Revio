import { lstat, readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { checkIgnoredPaths } from '../../source-control/check-ignored-paths'
import type { GitRuntimeOptions } from '../../git-runtime-options'
import { mapWithConcurrency } from '../../../../shared/map-with-concurrency'
import { gitExecFileAsync } from '../../command-runner/git-exec-file'
import { gitOptionsForWorktree } from '../../git-runtime-options'
import type { WorktreeIncludePreview } from '../../../../shared/worktree-include-preview'

/** Cross-tool convention for copying selected gitignored paths into new worktrees (#7549). */
export const WORKTREE_INCLUDE_FILE = '.worktreeinclude'

const WORKTREE_INCLUDE_MAX_FILE_BYTES = 256 * 1024
const WORKTREE_INCLUDE_MAX_ENTRIES = 1000
// Bound stat fan-out without serializing independent paths.
const WORKTREE_INCLUDE_PATH_STAT_CONCURRENCY = 8

/** Entries are literal paths anchored to the repo root, without implicit depth matching. */
export function parseWorktreeIncludeFile(content: string): string[] {
  const seen = new Set<string>()
  const entries: string[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const normalized = line.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    entries.push(normalized)
  }
  return entries
}

function isUnsupportedPattern(entry: string): boolean {
  return entry.startsWith('!')
}

function isGlob(entry: string): boolean {
  return entry.includes('*') || entry.includes('?')
}

/** `*` and `?` stay inside one path segment; `**` crosses them (file_include_globs). */
export function worktreeIncludeGlobToRegExp(glob: string): RegExp {
  let pattern = ''
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index]
    if (char === '*' && glob[index + 1] === '*') {
      const slash = glob[index + 2] === '/'
      pattern += slash ? '(?:.*/)?' : '.*'
      index += slash ? 2 : 1
    } else if (char === '*') {
      pattern += '[^/]*'
    } else if (char === '?') {
      pattern += '[^/]'
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${pattern}$`)
}

/** Ignored, untracked paths; ignored directories (node_modules/) come back as one entry. */
async function listIgnoredPaths(repoPath: string, options: GitRuntimeOptions): Promise<string[]> {
  const { stdout } = await gitExecFileAsync(
    ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
    { ...gitOptionsForWorktree(repoPath, options), timeout: 15_000 }
  )
  return stdout
    .split('\0')
    .map((path) => path.replace(/\/$/, ''))
    .filter(Boolean)
}

function isSafeIncludePath(relativePath: string): boolean {
  if (!relativePath || isAbsolute(relativePath)) {
    return false
  }
  const segments = relativePath.split('/')
  return !segments.includes('..') && !segments.includes('') && segments[0] !== '.git'
}

async function readWorktreeIncludeFile(repoPath: string): Promise<string | null> {
  const includePath = join(repoPath, WORKTREE_INCLUDE_FILE)
  try {
    const stats = await lstat(includePath)
    if (!stats.isFile() || stats.size > WORKTREE_INCLUDE_MAX_FILE_BYTES) {
      return null
    }
    return await readFile(includePath, 'utf8')
  } catch {
    return null
  }
}

/**
 * Copy only existing, gitignored paths; failures return [] so inclusion cannot block creation.
 * Without a .worktreeinclude, `defaultPatterns` apply (the workspace layout copies `.env*`).
 */
export async function resolveWorktreeIncludePaths(
  repoPath: string,
  options: GitRuntimeOptions = {},
  defaultPatterns: readonly string[] = []
): Promise<string[]> {
  try {
    const content = await readWorktreeIncludeFile(repoPath)
    const entries = content === null ? [...defaultPatterns] : parseWorktreeIncludeFile(content)
    if (entries.length === 0) {
      return []
    }

    const candidates: string[] = []
    const globs: RegExp[] = []
    for (const entry of entries) {
      if (candidates.length >= WORKTREE_INCLUDE_MAX_ENTRIES) {
        console.warn(
          `[worktree-include] ${WORKTREE_INCLUDE_FILE} lists more than ${WORKTREE_INCLUDE_MAX_ENTRIES} entries; ignoring the rest`
        )
        break
      }
      if (isUnsupportedPattern(entry)) {
        console.warn(
          `[worktree-include] Skipping unsupported ${WORKTREE_INCLUDE_FILE} pattern "${entry}" (negation is not supported)`
        )
        continue
      }
      if (isGlob(entry)) {
        globs.push(worktreeIncludeGlobToRegExp(entry))
        continue
      }
      if (!isSafeIncludePath(entry)) {
        console.warn(`[worktree-include] Skipping unsafe ${WORKTREE_INCLUDE_FILE} path "${entry}"`)
        continue
      }
      candidates.push(entry)
    }
    if (globs.length > 0) {
      for (const path of await listIgnoredPaths(repoPath, options)) {
        if (
          candidates.length < WORKTREE_INCLUDE_MAX_ENTRIES &&
          isSafeIncludePath(path) &&
          !candidates.includes(path) &&
          globs.some((glob) => glob.test(path))
        ) {
          candidates.push(path)
        }
      }
    }
    if (candidates.length === 0) {
      return []
    }

    const existence = await mapWithConcurrency(
      candidates,
      WORKTREE_INCLUDE_PATH_STAT_CONCURRENCY,
      async (relativePath) => {
        try {
          await lstat(join(repoPath, relativePath))
          return relativePath
        } catch {
          return null
        }
      }
    )
    const existing = existence.filter(
      (relativePath): relativePath is string => relativePath !== null
    )
    if (existing.length === 0) {
      return []
    }

    // Copying unignored paths would introduce spurious worktree diffs.
    const ignored = new Set(await checkIgnoredPaths(repoPath, existing, options))
    return existing.filter((relativePath) => ignored.has(relativePath)).sort()
  } catch (error) {
    console.warn(`[worktree-include] Failed to resolve ${WORKTREE_INCLUDE_FILE} paths:`, error)
    return []
  }
}

/** The gitignored files a new workspace would get copied, for Settings' "Files to copy" preview. */
export async function previewWorktreeIncludePaths(
  repoPath: string,
  patterns: readonly string[],
  options: GitRuntimeOptions = {}
): Promise<WorktreeIncludePreview> {
  const contents = await readWorktreeIncludeFile(repoPath)
  const files = await resolveWorktreeIncludePaths(repoPath, options, patterns)
  return contents === null
    ? { source: 'patterns', contents: null, files }
    : { source: 'worktreeinclude', contents, files }
}
