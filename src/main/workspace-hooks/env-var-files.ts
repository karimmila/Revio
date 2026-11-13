import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { parseEnvFile } from '../../shared/env-file-parse'

let lookup: (repoId: string) => readonly string[] = () => []

/** Settings, repository, "Environment variable files" (environment_variable_files). */
export function setEnvVarFilesLookup(next: (repoId: string) => readonly string[]): void {
  lookup = next
}

/**
 * The variables of the repository's env files, read from the workspace (relative paths) in list
 * order, later files winning. A missing or unreadable file is skipped: setup must still run.
 */
export function readEnvVarFiles(repoId: string, worktreePath: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const file of lookup(repoId)) {
    try {
      Object.assign(
        env,
        parseEnvFile(readFileSync(isAbsolute(file) ? file : join(worktreePath, file), 'utf8'))
      )
    } catch {
      // Skipped: the file may only appear after setup creates it.
    }
  }
  return env
}
