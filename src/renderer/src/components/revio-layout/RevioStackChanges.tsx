import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { detectLanguage } from '@/lib/language-detect'
import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type {
  GitBranchChangeEntry,
  GitBranchCompareResult
} from '../../../../shared/git/diff/git-diff-compare-types'
import { RevioChangesList } from './RevioChangesList'
import { RevioGraphiteStack } from './RevioGraphiteStack'
import {
  selectRevioStackEntry,
  stackEntryBase,
  useRevioStack,
  useSelectedStackEntry,
  type RevioStack
} from './use-revio-pull-request'

type ChangesProps = {
  worktreeId: string
  worktreePath: string
  statusEntries: readonly GitStatusEntry[]
  branchEntries: readonly GitBranchChangeEntry[]
  onOpenUncommitted: (entry: GitStatusEntry) => void
  onOpenCommitted: (entry: GitBranchChangeEntry) => void
  onDiscard?: (entry: GitStatusEntry) => void
  commitSurface: React.ReactNode
}

function failedCompare(
  request: { baseRef: string; headRef: string },
  errorMessage: string
): GitBranchCompareResult {
  const { baseRef, headRef } = request
  const summary = { baseRef, baseOid: null, compareRef: headRef, headOid: null, mergeBase: null }
  return { summary: { ...summary, changedFiles: 0, status: 'error', errorMessage }, entries: [] }
}

/** Files `headRef` changes against `baseRef`, reloaded when `refreshKey` changes (new commits). */
function useRefCompare(
  worktreePath: string,
  request: { baseRef: string; headRef: string } | null,
  refreshKey: unknown
): GitBranchCompareResult | null {
  const [result, setResult] = React.useState<{ key: string; value: GitBranchCompareResult } | null>(
    null
  )
  const key = request ? `${worktreePath}\0${request.baseRef}\0${request.headRef}` : ''
  React.useEffect(() => {
    if (!request) {
      return
    }
    let live = true
    void window.api.git
      .refCompare({ worktreePath, baseRef: request.baseRef, headRef: request.headRef })
      .then((value) => live && setResult({ key, value }))
      .catch((error: unknown) => {
        if (live) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          setResult({ key, value: failedCompare(request, errorMessage) })
        }
      })
    return () => {
      live = false
    }
    // `request` is rebuilt each render; `key` names it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey])
  return result?.key === key ? result.value : null
}

function StackRail({
  stack,
  selectedNumber,
  worktreeId
}: {
  stack: RevioStack
  selectedNumber: number
  worktreeId: string
}): React.JSX.Element {
  return (
    <nav data-revio-stack-rail="">
      {stack.entries.map((entry) => (
        <button
          key={entry.number}
          type="button"
          data-revio-stack-rail-item=""
          data-active={entry.number === selectedNumber ? 'true' : undefined}
          title={entry.title}
          onClick={() => selectRevioStackEntry(worktreeId, entry.number)}
        >
          <span data-revio-stack-rail-dot="" />#{entry.number}
        </button>
      ))}
      <div data-revio-stack-rail-item="" data-revio-stack-rail-base="">
        <span data-revio-stack-rail-dot="" />
        {stack.baseRefName}
      </div>
    </nav>
  )
}

/**
 * The Changes tab for a workspace whose PR is part of a stack: a rail of the stack's PRs,
 * and for the one picked only the files that PR changes against the PR below it. The workspace's
 * own PR also shows its uncommitted files and the commit surface.
 */
export function RevioChanges(props: ChangesProps): React.JSX.Element {
  const stack = useRevioStack()
  const entry = useSelectedStackEntry(stack)
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)
  const own = !!stack && !!entry && entry.number === stack.ownNumber
  const request =
    stack && entry && (own || entry.headRefName)
      ? { baseRef: stackEntryBase(stack, entry), headRef: own ? 'HEAD' : (entry.headRefName ?? '') }
      : null
  const compare = useRefCompare(props.worktreePath, request, props.branchEntries)
  if (!stack || !entry) {
    return (
      <>
        <RevioGraphiteStack
          worktreeId={props.worktreeId}
          worktreePath={props.worktreePath}
          refreshKey={props.statusEntries}
        />
        <RevioChangesList {...props} />
      </>
    )
  }
  const error = compare && compare.summary.status !== 'ready' ? compare.summary.errorMessage : null
  return (
    <div className="flex min-h-0">
      <StackRail stack={stack} selectedNumber={entry.number} worktreeId={props.worktreeId} />
      <div className="min-w-0 flex-1">
        {error ? <p data-revio-stack-error="">{error}</p> : null}
        {compare === null && !error ? (
          <p data-revio-stack-error="">
            {translate('auto.components.revioLayout.stackLoading', 'Loading changes…')}
          </p>
        ) : null}
        <RevioChangesList
          statusEntries={own ? props.statusEntries : []}
          branchEntries={compare?.entries ?? []}
          onOpenUncommitted={props.onOpenUncommitted}
          onDiscard={own ? props.onDiscard : undefined}
          worktreeId={props.worktreeId}
          onOpenCommitted={(changed) => {
            if (compare?.summary.status === 'ready') {
              openBranchDiff(
                props.worktreeId,
                props.worktreePath,
                changed,
                compare.summary,
                detectLanguage(changed.path)
              )
            }
          }}
          commitSurface={own ? props.commitSurface : null}
        />
      </div>
    </div>
  )
}
