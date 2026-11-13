import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { runInRevioDock } from './revio-dock-terminals'

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

/**
 * The Spotlight testing, in our own shell: every second, when the workspace's files or
 * HEAD changed, snapshot its working tree (tracked and untracked, not ignored) into a tree object
 * through a private index, then write that tree into the repository root's working tree. The root
 * keeps its branch and HEAD: the workspace's work shows there as uncommitted changes, ready for the
 * root's dev server. Skips while a merge or rebase runs in the workspace.
 */
export function spotlightScript(rootPath: string, worktreePath: string): string {
  const root = quote(rootPath)
  const ws = quote(worktreePath)
  return [
    `idx="$(mktemp)"; last=""`,
    `trap 'rm -f "$idx"' EXIT`,
    `printf '\\033[2m● Spotlight: syncing %s into %s\\033[0m\\n' ${ws} ${root}`,
    'while :; do',
    `  sig="$(git -C ${ws} rev-parse HEAD 2>/dev/null)$(git -C ${ws} status --porcelain=v1 -uall 2>/dev/null | git hash-object --stdin)"`,
    '  if [ "$sig" != "$last" ]; then',
    `    gd="$(git -C ${ws} rev-parse --absolute-git-dir)"`,
    '    if [ -e "$gd/MERGE_HEAD" ] || [ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ]; then',
    `      echo "Skipping sync: merge or rebase in progress"`,
    '    else',
    `      GIT_INDEX_FILE="$idx" git -C ${ws} read-tree HEAD && GIT_INDEX_FILE="$idx" git -C ${ws} add -A && tree="$(GIT_INDEX_FILE="$idx" git -C ${ws} write-tree)" && git -C ${root} read-tree -u --reset "$tree" && git -C ${root} read-tree HEAD && echo "Synced $(date +%H:%M:%S)" || echo "Sync failed"`,
    '    fi',
    '    last="$sig"',
    '  fi',
    '  sleep 1',
    'done'
  ].join('\n')
}

const title = (): string => translate('auto.components.revioLayout.spotlightTab', 'Spotlight')

/** The open Spotlight tab of this workspace in the dock, if any. */
export function spotlightTabId(worktreeId: string): string | null {
  const state = useAppStore.getState()
  return (
    (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).find(
      (tab) => tab.customTitle === title() && spotlightOwners.get(tab.id) === worktreeId
    )?.id ?? null
  )
}

const spotlightOwners = new Map<string, string>()

/** Starts Spotlight for a workspace on this Mac, or stops it when it runs. Returns whether it runs now. */
export function toggleSpotlight(worktreeId: string): boolean {
  const running = spotlightTabId(worktreeId)
  if (running) {
    useAppStore.getState().closeTab(running)
    spotlightOwners.delete(running)
    return false
  }
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!worktree || !repo || worktree.isMainWorktree) {
    return false
  }
  const tabId = runInRevioDock(worktreeId, title(), spotlightScript(repo.path, worktree.path))
  if (tabId) {
    spotlightOwners.set(tabId, worktreeId)
  }
  return tabId !== null
}
