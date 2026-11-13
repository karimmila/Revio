import { isReservedVariableKey } from '../../shared/workspace-variables/dotenv'
import { readScopeValues } from './workspace-variables-files'

/** Finds the repository a folder belongs to: a worktree of it, or its main checkout. */
export type RepoForPath = (cwd: string) => string | null

let repoForPath: RepoForPath = () => null

export function setWorkspaceVariablesRepoResolver(next: RepoForPath): void {
  repoForPath = next
}

/** The folder a workspace id names (`<repoId>::<path>`); folder workspaces carry no path. */
export function workspacePathOf(workspaceId: string): string | undefined {
  const separator = workspaceId.indexOf('::')
  return separator > 0 ? workspaceId.slice(separator + 2) : undefined
}

/** Global values, then the folder's repository values over them; reserved keys never pass. */
export function workspaceVariablesForPath(cwd: string | undefined): Record<string, string> {
  const merged: Record<string, string> = {}
  let layers: Record<string, string>[]
  try {
    const repoId = cwd ? repoForPath(cwd) : null
    layers = [readScopeValues({ kind: 'global' })]
    if (repoId) {
      layers.push(readScopeValues({ kind: 'repo', repoId }))
    }
  } catch (error) {
    // A missing or broken variables file must never stop a terminal or chat from starting.
    console.warn('[workspace-variables] skipped:', error)
    return merged
  }
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (!isReservedVariableKey(key)) {
        merged[key] = value
      }
    }
  }
  return merged
}

/**
 * Adds the folder's workspace variables to a spawn environment. They replace values the shell
 * inherited, but never a key the caller set on purpose for this spawn (an agent's own defaults).
 */
export function applyWorkspaceVariables(
  env: Record<string, string>,
  cwd: string | undefined,
  explicitKeys: Iterable<string> = []
): void {
  const variables = workspaceVariablesForPath(cwd)
  const keep = new Set(explicitKeys)
  for (const [key, value] of Object.entries(variables)) {
    if (!keep.has(key)) {
      env[key] = value
    }
  }
}

/** The repository whose worktree or checkout holds `cwd`, by the longest matching path. */
export function findRepoForPath(
  cwd: string,
  worktreeIds: Iterable<string>,
  repos: Iterable<{ id: string; path: string }>
): string | null {
  const candidates: { repoId: string; root: string }[] = []
  for (const worktreeId of worktreeIds) {
    const separator = worktreeId.indexOf('::')
    if (separator > 0) {
      candidates.push({
        repoId: worktreeId.slice(0, separator),
        root: worktreeId.slice(separator + 2)
      })
    }
  }
  for (const repo of repos) {
    candidates.push({ repoId: repo.id, root: repo.path })
  }
  let bestRepo: string | null = null
  let bestLength = 0
  for (const { repoId, root } of candidates) {
    const trimmed = root.replace(/\/+$/, '')
    if (
      trimmed &&
      (cwd === trimmed || cwd.startsWith(`${trimmed}/`)) &&
      trimmed.length > bestLength
    ) {
      bestRepo = repoId
      bestLength = trimmed.length
    }
  }
  return bestRepo
}
