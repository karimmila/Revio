import {
  Archive,
  Eye,
  FileDiff,
  Files,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitPullRequestCreateArrow,
  ListChecks,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Search,
  Wrench
} from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { revioLayoutActive } from '@/components/revio-layout/revio-root-flags'
import type { CmdJQuickAction } from './quick-actions'
import { getRevioPaletteAppActions } from './revio-palette-app-actions'
import { action } from './revio-palette-action'

/** Runs the key that owns this action, so the palette and the key do the same thing. */
function pressRevioKey(code: string, shift = true): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      key: code.slice(-1).toLowerCase(),
      metaKey: true,
      shiftKey: shift,
      bubbles: true,
      cancelable: true
    })
  )
}

function showTab(tab: 'explorer' | 'source-control' | 'checks'): void {
  const state = useAppStore.getState()
  state.setRightSidebarOpen(true)
  state.setRightSidebarTab(tab)
}

/**
 * The command palette actions (⌘K), offered in the workspace layout beside Orca's own
 * actions and the workspace list: the right panel's views, the PR and git steps, review, archive.
 */
export function getRevioPaletteActions(): CmdJQuickAction[] {
  if (typeof document === 'undefined' || !revioLayoutActive()) {
    return []
  }
  const say = translate
  return [
    action(
      'show-changes',
      say('auto.components.cmd.j.revio.showChanges', 'Show changes'),
      FileDiff,
      ['changes', 'diff'],
      () => showTab('source-control')
    ),
    action(
      'show-files',
      say('auto.components.cmd.j.revio.showAllFiles', 'Show all files'),
      Files,
      ['files', 'tree'],
      () => showTab('explorer')
    ),
    action(
      'show-checks',
      say('auto.components.cmd.j.revio.showChecks', 'Show checks'),
      ListChecks,
      ['checks', 'ci'],
      () => showTab('checks')
    ),
    action(
      'search-files',
      say('auto.components.cmd.j.revio.searchInFiles', 'Search in files'),
      Search,
      ['search', 'grep', 'find'],
      () => useAppStore.getState().showRightSidebarSearch()
    ),
    action(
      'open-diff',
      say('auto.components.cmd.j.revio.openDiff', 'Open diff view'),
      FileDiff,
      ['diff', 'review'],
      () => pressRevioKey('KeyD')
    ),
    action(
      'create-pr',
      say('auto.components.cmd.j.revio.createPr', 'Create PR'),
      GitPullRequestCreateArrow,
      ['pull request', 'pr'],
      () => pressRevioKey('KeyP')
    ),
    action(
      'open-pr',
      say('auto.components.cmd.j.revio.openPr', 'Open pull request'),
      GitPullRequest,
      ['pull request', 'github'],
      () => pressRevioKey('KeyG')
    ),
    action(
      'merge-pr',
      say('auto.components.cmd.j.revio.mergePr', 'Merge PR'),
      GitMerge,
      ['merge'],
      () => pressRevioKey('KeyM')
    ),
    action(
      'fix-errors',
      say('auto.components.cmd.j.revio.fixErrors', 'Fix errors'),
      Wrench,
      ['checks', 'ci', 'fix'],
      () => pressRevioKey('KeyX')
    ),
    action(
      'commit-push',
      say('auto.components.cmd.j.revio.commitAndPush', 'Commit and push'),
      GitCommitHorizontal,
      ['commit', 'push'],
      () => pressRevioKey('KeyY')
    ),
    action(
      'pull-latest',
      say('auto.components.cmd.j.revio.pullLatest', 'Pull latest from main'),
      RefreshCw,
      ['pull', 'rebase', 'main'],
      () => pressRevioKey('KeyL')
    ),
    action(
      'review',
      say('auto.components.cmd.j.revio.startReview', 'Start review'),
      Eye,
      ['review'],
      () => pressRevioKey('KeyR')
    ),
    action(
      'archive',
      say('auto.components.cmd.j.revio.archiveWorkspace', 'Archive workspace'),
      Archive,
      ['archive', 'delete'],
      () => {
        const id = useAppStore.getState().activeWorktreeId
        if (id) {
          void import('@/components/sidebar/workspace-actions/deletion/delete-worktree-flow').then(
            ({ runWorktreeDelete }) => runWorktreeDelete(id)
          )
        }
      }
    ),
    action(
      'toggle-left',
      say('auto.components.cmd.j.revio.toggleLeftSidebar', 'Toggle left sidebar'),
      PanelLeft,
      ['sidebar'],
      () => useAppStore.getState().toggleSidebar(),
      false
    ),
    action(
      'toggle-right',
      say('auto.components.cmd.j.revio.toggleRightSidebar', 'Toggle right sidebar'),
      PanelRight,
      ['panel', 'sidebar'],
      () => useAppStore.getState().toggleRightSidebar(),
      false
    ),
    ...getRevioPaletteAppActions()
  ]
}
