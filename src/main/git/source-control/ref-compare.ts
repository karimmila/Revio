import type { GitBranchCompareResult } from '../../../shared/git/diff/git-diff-compare-types'
import type { GitRuntimeOptions } from '../git-runtime-options'
import { loadBranchChanges } from './branch-change-entries'
import { resolveMergeBase, resolveRefOid } from './compare-ref-oids'

/** A branch name resolves to its local head first, then to origin's copy of it. */
async function resolveBranchOid(
  worktreePath: string,
  ref: string,
  options: GitRuntimeOptions
): Promise<{ ref: string; oid: string } | null> {
  const candidates =
    ref === 'HEAD' || ref.startsWith('refs/')
      ? [ref]
      : [`refs/heads/${ref}`, `refs/remotes/origin/${ref}`, ref]
  for (const candidate of candidates) {
    try {
      return { ref: candidate, oid: await resolveRefOid(worktreePath, candidate, options) }
    } catch {
      // Try the next spelling of the ref.
    }
  }
  return null
}

/**
 * Files one pull request of a stack changes: its head against the merge base with the branch it
 * targets (the PR below it, or the stack's base). Unlike getBranchCompare, neither side is HEAD.
 */
export async function getRefCompare(
  worktreePath: string,
  baseRef: string,
  headRef: string,
  options: GitRuntimeOptions = {}
): Promise<GitBranchCompareResult> {
  const [base, head] = await Promise.all([
    resolveBranchOid(worktreePath, baseRef, options),
    resolveBranchOid(worktreePath, headRef, options)
  ])
  const summary = {
    baseRef: base?.ref ?? baseRef,
    baseOid: base?.oid ?? null,
    compareRef: head?.ref ?? headRef,
    headOid: head?.oid ?? null,
    mergeBase: null,
    changedFiles: 0
  }
  if (!base) {
    return {
      summary: {
        ...summary,
        status: 'invalid-base',
        errorMessage: `Branch ${baseRef} is not in this repository. Fetch it to see this pull request's changes.`
      },
      entries: []
    }
  }
  if (!head) {
    return {
      summary: {
        ...summary,
        status: 'error',
        errorMessage: `Branch ${headRef} is not in this repository. Fetch it to see this pull request's changes.`
      },
      entries: []
    }
  }
  try {
    const mergeBase = await resolveMergeBase(worktreePath, base.oid, head.oid, options)
    const entries = await loadBranchChanges(worktreePath, mergeBase, head.oid, options)
    return {
      summary: { ...summary, mergeBase, changedFiles: entries.length, status: 'ready' },
      entries
    }
  } catch (error) {
    return {
      summary: {
        ...summary,
        status: 'no-merge-base',
        errorMessage: error instanceof Error ? error.message : 'Failed to compare branches'
      },
      entries: []
    }
  }
}
