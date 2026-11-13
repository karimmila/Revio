import { translate } from '@/i18n/i18n'
import type { WorktreeCardPrDisplay } from '@/components/sidebar/workspace-card/review/worktree-card-pr-display'
import type { WorktreeStatus } from '../../../../shared/worktree-status-rollup'
import type { SetupStatus } from '../../../../shared/setup-status'
import type { RevioChatPhase } from './use-revio-chat-phase'

/** The sidebar git states for a workspace's pull request, most decisive first. */
export type RevioRowPrState =
  | 'merged'
  | 'merge-queued'
  | 'ready-to-merge'
  | 'draft-pr'
  | 'merge-conflict'
  | 'checks-failing'
  | 'checks-pending'
  | 'open-pr'

type Rule = [RevioRowPrState, (pr: Facts) => boolean]

type Facts = {
  state: string | undefined
  mergeable: string | undefined
  mergeStateStatus: string | null | undefined
  checks: string | undefined
  queued: boolean
  optionalChecksBlocking: boolean
}

// The rule list, first match wins. A closed pull request matches nothing, so the row
// shows its branch.
const RULES: Rule[] = [
  ['merged', (pr) => pr.state === 'merged'],
  ['merge-queued', (pr) => pr.state === 'open' && pr.queued],
  [
    'ready-to-merge',
    (pr) =>
      pr.state === 'open' &&
      (pr.mergeStateStatus === 'CLEAN' ||
        (pr.mergeStateStatus === 'UNSTABLE' && !pr.optionalChecksBlocking))
  ],
  ['draft-pr', (pr) => pr.state === 'draft'],
  [
    'merge-conflict',
    (pr) =>
      pr.state !== 'closed' && (pr.mergeStateStatus === 'DIRTY' || pr.mergeable === 'CONFLICTING')
  ],
  ['checks-failing', (pr) => pr.state !== 'closed' && pr.checks === 'failure'],
  ['checks-pending', (pr) => pr.state !== 'closed' && pr.checks === 'pending'],
  ['open-pr', (pr) => pr.state === 'open']
]

/**
 * The row's pull-request state (stripe and row list). Orca's PR cache has no merge
 * queue entry, so a PR set to auto-merge through a required queue counts as queued.
 */
export function revioRowPrState(
  pr: WorktreeCardPrDisplay | null,
  optionalChecksBlocking = false
): RevioRowPrState | null {
  if (!pr) {
    return null
  }
  const facts: Facts = {
    state: pr.state,
    mergeable: 'mergeable' in pr ? pr.mergeable : undefined,
    mergeStateStatus: 'mergeStateStatus' in pr ? pr.mergeStateStatus : undefined,
    checks: pr.status,
    queued:
      'autoMergeEnabled' in pr && pr.autoMergeEnabled === true && pr.mergeQueueRequired === true,
    optionalChecksBlocking
  }
  return RULES.find(([, matches]) => matches(facts))?.[0] ?? null
}

/** The CSS colour token for a state's stripe and icon (IWt). */
export function revioRowPrColor(state: RevioRowPrState): string {
  switch (state) {
    case 'merged':
      return 'var(--revio-row-merged)'
    case 'merge-queued':
      return 'var(--revio-row-queued)'
    case 'ready-to-merge':
      return 'var(--revio-row-ready)'
    case 'merge-conflict':
      return 'var(--revio-row-conflict)'
    case 'checks-failing':
      return 'var(--revio-row-failing)'
    case 'checks-pending':
      return 'var(--revio-row-pending)'
    case 'draft-pr':
    case 'open-pr':
      return 'var(--revio-row-muted)'
  }
}

export function revioRowPrLabel(state: RevioRowPrState | null): string {
  switch (state) {
    case 'merged':
      return translate('auto.components.revioLayout.toneMerged', 'Merged')
    case 'merge-queued':
      return translate('auto.components.revioLayout.rowInMergeQueue', 'In merge queue')
    case 'ready-to-merge':
      return translate('auto.components.revioLayout.prReadyToMerge', 'Ready to merge')
    case 'draft-pr':
      return translate('auto.components.revioLayout.toneDraft', 'Draft pull request')
    case 'merge-conflict':
      return translate('auto.components.revioLayout.toneConflict', 'Merge conflict')
    case 'checks-failing':
      return translate('auto.components.revioLayout.toneFailing', 'Checks failing')
    case 'checks-pending':
      return translate('auto.components.revioLayout.rowChecksRunning', 'Checks running')
    case 'open-pr':
      return translate('auto.components.revioLayout.toneOpen', 'Pull request open')
    case null:
      return translate('auto.components.revioLayout.rowReady', 'Ready')
  }
}

/** Workspace and agent states, which take the row icon before any pull-request state. */
export type RevioRowAgentIcon =
  | 'setting-up'
  | 'failed'
  | 'needs-plan-response'
  | 'needs-user-permission'
  | 'needs-user-input'
  | 'working'
  | 'waiting'

/** The order: setup, then a failure, then what the agent needs, then the agent at work. */
export function revioRowAgentIcon({
  setup,
  status,
  phase
}: {
  setup: SetupStatus | null
  status: WorktreeStatus
  phase: RevioChatPhase | null
}): RevioRowAgentIcon | null {
  if (setup === 'running') {
    return 'setting-up'
  }
  if (status === 'failed') {
    return 'failed'
  }
  if (phase === 'plan') {
    return 'needs-plan-response'
  }
  if (status === 'permission') {
    return 'needs-user-permission'
  }
  if (phase === 'question') {
    return 'needs-user-input'
  }
  if (status === 'working') {
    return 'working'
  }
  return status === 'monitoring' ? 'waiting' : null
}
