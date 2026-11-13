import type React from 'react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useRevioBranchCommits } from './revio-branch-commits'

/** The branch's commits in the Changes "⋮" menu; picking one opens that commit's changes. */
export function RevioBranchCommitItems(): React.JSX.Element | null {
  const { commits, loading, open } = useRevioBranchCommits()
  if (commits.length === 0 && !loading) {
    return null
  }
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel data-revio-menu-note="">
        {loading && commits.length === 0
          ? translate('auto.components.revioLayout.commitsLoading', 'Loading commits…')
          : translate('auto.components.revioLayout.commits', 'Commits')}
      </DropdownMenuLabel>
      {commits.map((commit) => (
        <DropdownMenuItem key={commit.id} onSelect={() => open(commit)} title={commit.message}>
          <span className="min-w-0 flex-1 truncate">{commit.subject}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {commit.displayId ?? commit.id.slice(0, 7)}
          </span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
