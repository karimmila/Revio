import { basename } from 'node:path'
import type { Repo } from '../../shared/repo-types'

/** A repository's main checkout and every worktree Orca knows for it, labelled by folder name. */
export function repoFoldersFor(
  store: { getRepos: () => Repo[]; getAllWorktreeMeta: () => Record<string, unknown> },
  repoId: string
): { label: string; path: string }[] {
  const repo = store.getRepos().find((candidate) => candidate.id === repoId)
  const paths = new Set<string>(repo ? [repo.path] : [])
  for (const worktreeId of Object.keys(store.getAllWorktreeMeta())) {
    if (worktreeId.startsWith(`${repoId}::`)) {
      paths.add(worktreeId.slice(repoId.length + 2))
    }
  }
  return [...paths].map((path) => ({ label: basename(path), path }))
}
