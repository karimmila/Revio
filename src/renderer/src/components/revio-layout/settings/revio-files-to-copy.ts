import {
  DEFAULT_FILES_TO_COPY,
  parseFilesToCopy
} from '../../../../../shared/worktree-include-preview'

/** The repository's "Files to copy" patterns as the text area shows them, one per line. */
export function filesToCopyText(
  globs: Record<string, string[]> | undefined,
  repoId: string
): string {
  return (globs?.[repoId] ?? DEFAULT_FILES_TO_COPY).join('\n')
}

/** The settings map after saving `text` for a repository; the default pattern list clears the entry. */
export function withFilesToCopy(
  globs: Record<string, string[]> | undefined,
  repoId: string,
  text: string
): Record<string, string[]> {
  const { [repoId]: _previous, ...rest } = globs ?? {}
  const patterns = parseFilesToCopy(text)
  const isDefault =
    patterns.length === DEFAULT_FILES_TO_COPY.length &&
    patterns.every((pattern, index) => pattern === DEFAULT_FILES_TO_COPY[index])
  return isDefault ? rest : { ...rest, [repoId]: patterns }
}
