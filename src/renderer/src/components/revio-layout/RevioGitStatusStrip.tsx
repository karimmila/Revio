import React from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { GitUpstreamStatus } from '../../../../shared/git/status/git-status-types'
import {
  commitAndPushWithAgent,
  listenForRevioGitActions,
  pullLatestWithRevio,
  remoteSyncState,
  resolveRemoteIncompatibilityWithAgent,
  type RevioGitAction
} from './revio-git-actions'

type Item = { id: string; text: string; label: string; run: () => void }

/**
 * The git status lines above the Changes list: uncommitted changes with Commit and push,
 * commits behind or ahead of the remote with Pull or Push, and commits behind the target branch
 * with "Pull latest". Pull, Push and the rebase are Orca's own source-control actions.
 */
export function RevioGitStatusStrip({
  worktreeId,
  uncommitted,
  remoteStatus,
  behindBase,
  baseRef,
  runAction
}: {
  worktreeId: string
  uncommitted: number
  remoteStatus: GitUpstreamStatus | null | undefined
  behindBase: number
  baseRef: string | null
  runAction: (action: RevioGitAction) => void
}): React.JSX.Element | null {
  const busy = useAppStore((s) => s.isRemoteOperationActive)
  React.useEffect(
    () =>
      listenForRevioGitActions((action) => {
        if (action === 'rebase_base' && baseRef) {
          void pullLatestWithRevio(worktreeId, baseRef, () => runAction(action))
        } else {
          runAction(action)
        }
        return true
      }),
    [runAction, worktreeId, baseRef]
  )
  const behind = remoteStatus?.hasUpstream ? remoteStatus.behind : 0
  const ahead = remoteStatus?.hasUpstream ? remoteStatus.ahead : 0
  const sync = remoteSyncState(ahead, behind)
  const items: Item[] = []
  if (uncommitted > 0) {
    items.push({
      id: 'uncommitted',
      text: translate(
        'auto.components.revioLayout.git.uncommitted',
        '{{count}} uncommitted changes',
        {
          count: uncommitted,
          defaultValue_one: '{{count}} uncommitted change'
        }
      ),
      label: translate('auto.components.revioLayout.git.commitAndPush', 'Commit and push'),
      run: () => commitAndPushWithAgent(worktreeId)
    })
  }
  if (sync === 'incompatible') {
    items.push({
      id: 'incompatible',
      text: translate('auto.components.revioLayout.git.incompatible', 'Incompatible with remote'),
      label: translate('auto.components.revioLayout.resolve', 'Resolve'),
      run: () => resolveRemoteIncompatibilityWithAgent(worktreeId)
    })
  }
  if (sync === 'behind') {
    items.push({
      id: 'behind',
      text: translate(
        'auto.components.revioLayout.git.behindRemote',
        '{{count}} commits behind remote',
        {
          count: behind,
          defaultValue_one: '{{count}} commit behind remote'
        }
      ),
      label: translate('auto.components.revioLayout.git.pull', 'Pull'),
      run: () => runAction('pull')
    })
  }
  if (sync === 'ahead' && uncommitted === 0) {
    items.push({
      id: 'ahead',
      text: translate(
        'auto.components.revioLayout.git.aheadRemote',
        '{{count}} commits ahead of remote',
        {
          count: ahead,
          defaultValue_one: '{{count}} commit ahead of remote'
        }
      ),
      label: translate('auto.components.revioLayout.git.push', 'Push'),
      run: () => runAction('push')
    })
  }
  if (behindBase > 0 && baseRef) {
    items.push({
      id: 'behind-base',
      text: translate('auto.components.revioLayout.git.behindBase', '{{count}} behind {{base}}', {
        count: behindBase,
        base: baseRef
      }),
      label: translate('auto.components.revioLayout.git.pullLatest', 'Pull latest'),
      run: () => void pullLatestWithRevio(worktreeId, baseRef, () => runAction('rebase_base'))
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <div className="flex shrink-0 flex-col border-b border-border py-1" data-revio-git-status="">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex h-7 items-center gap-2 px-3 text-[12px] text-muted-foreground"
        >
          <span className="min-w-0 flex-1 truncate">{item.text}</span>
          <button
            type="button"
            disabled={busy}
            onClick={item.run}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
