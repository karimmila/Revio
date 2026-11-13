/** One value a key takes across a repository's worktrees, and where it was found. */
export type WorktreeEnvValue = { value: string; locations: string[] }

export type WorktreeEnvKeyReport = { key: string; values: WorktreeEnvValue[] }

export type WorktreeEnvScanResult = {
  folders: number
  files: number
  keys: WorktreeEnvKeyReport[]
}
