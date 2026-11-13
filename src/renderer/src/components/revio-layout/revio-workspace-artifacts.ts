import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type { GitBranchChangeEntry } from '../../../../shared/git/diff/git-diff-compare-types'

const ARTIFACT_FILE = /\.html?$/i

/** HTML pages the workspace added or changed (its artifacts), newest change set first, by path. */
export function workspaceArtifactPaths(
  statusEntries: readonly GitStatusEntry[],
  branchEntries: readonly GitBranchChangeEntry[]
): string[] {
  const paths = new Set<string>()
  for (const entry of [...statusEntries, ...branchEntries]) {
    if (entry.status !== 'deleted' && ARTIFACT_FILE.test(entry.path)) {
      paths.add(entry.path)
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b))
}

export function editWithAgentPrompt(path: string): string {
  return `Edit the artifact ${path}: `
}
