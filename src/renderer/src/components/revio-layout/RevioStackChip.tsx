import React from 'react'
import { CircleCheck, CircleDot, CircleMinus, CircleX, GitMerge, Layers } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { GitHubPRStackEntry } from '../../../../shared/github/pull-request-types'
import { selectRevioStackEntry, type RevioStack } from './use-revio-pull-request'

function EntryIcon({ entry }: { entry: GitHubPRStackEntry }): React.JSX.Element {
  if (entry.state === 'merged') {
    return <GitMerge className="size-4 text-[var(--revio-pr-merged)]" />
  }
  if (entry.state === 'closed' || entry.checksStatus === 'failure') {
    return <CircleX className="size-4 text-[var(--git-decoration-deleted)]" />
  }
  if (entry.mergeable === 'CONFLICTING' || entry.checksStatus === 'pending') {
    return <CircleDot className="size-4 text-[var(--revio-stack-attention)]" />
  }
  if (entry.reviewDecision === 'APPROVED' && entry.checksStatus === 'success') {
    return <CircleCheck className="size-4 text-[var(--git-decoration-added)]" />
  }
  return <CircleMinus className="size-4 text-muted-foreground" />
}

function stackIsMergeable(stack: RevioStack): boolean {
  return stack.entries.every(
    (entry) =>
      entry.state === 'merged' ||
      (entry.state === 'open' &&
        entry.mergeable === 'MERGEABLE' &&
        entry.reviewDecision === 'APPROVED' &&
        (entry.checksStatus === 'success' || entry.checksStatus === 'neutral'))
  )
}

/**
 * The stack chip ("2/3"): its list shows each PR in the stack, top first, down to the base
 * branch. Picking one points the PR header and the Changes tab at that PR.
 */
export function RevioStackChip({
  stack,
  selected
}: {
  stack: RevioStack
  selected: GitHubPRStackEntry
}): React.JSX.Element {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const [open, setOpen] = React.useState(false)
  const mergeable = stackIsMergeable(stack)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-revio-pr-chip=""
          aria-label={translate(
            'auto.components.revioLayout.stackPosition',
            'Pull request {{value0}} of {{value1}} in the stack',
            { value0: selected.position, value1: stack.entries.length }
          )}
          className="right-sidebar-header-no-drag flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-[var(--revio-pr-chip-border)] px-2 tabular-nums text-[var(--revio-pr-chip-text)] transition-colors hover:bg-foreground/5"
        >
          <Layers className="size-3.5" />
          {selected.position}/{stack.entries.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} data-revio-stack-popover="">
        <div data-revio-stack-heading="" data-mergeable={mergeable ? 'true' : undefined}>
          {mergeable
            ? translate('auto.components.revioLayout.stackReady', 'Ready to merge this stack')
            : translate('auto.components.revioLayout.stackBlocked', "Can't merge this stack yet")}
        </div>
        <div data-revio-stack-list="">
          {stack.entries.map((entry) => {
            const active = entry.number === selected.number
            return (
              <button
                key={entry.number}
                type="button"
                data-revio-stack-row=""
                data-active={active ? 'true' : undefined}
                onClick={() => {
                  if (worktreeId) {
                    selectRevioStackEntry(worktreeId, entry.number)
                  }
                  setOpen(false)
                }}
              >
                <span data-revio-stack-icon="">
                  <EntryIcon entry={entry} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-foreground">{entry.title}</span>
                  <span className="truncate text-muted-foreground">
                    #{entry.number}
                    {entry.headRefName ? ` · ${entry.headRefName}` : ''}
                  </span>
                </span>
                <span data-revio-stack-radio="" aria-hidden />
              </button>
            )
          })}
          <div data-revio-stack-row="" data-revio-stack-base="">
            <span data-revio-stack-icon="">
              <span data-revio-stack-base-dot="" />
            </span>
            <span className="font-mono text-muted-foreground">{stack.baseRefName}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
