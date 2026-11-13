/** Settings' "Files to copy" preview: what a new workspace would get copied, and from which rule. */
export type WorktreeIncludePreview = {
  /** `.worktreeinclude` wins over the repository's patterns (order). */
  source: 'worktreeinclude' | 'patterns'
  /** The `.worktreeinclude` text when that is the source. */
  contents: string | null
  files: string[]
}

/** The default when a repository names no files to copy. */
export const DEFAULT_FILES_TO_COPY = ['.env*']

/** One pattern per line; blank lines and `#` comments drop out. */
export function parseFilesToCopy(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}
