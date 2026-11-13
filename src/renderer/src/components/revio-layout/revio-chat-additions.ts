import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { PRComment } from '../../../../shared/github/comment-types'
import type { PRCommentGroup } from '../../../../shared/source-control/review-comments/pr-comment-groups'
import type { DiffComment } from '../../../../shared/diff-comment-types'

/** A pull request comment added to the next chat message with "Add to chat". */
export type ChatAddition = DiffComment & { prompt: string }

const ID_PREFIX = 'pr-comment:'
const EMPTY: readonly ChatAddition[] = []
let byWorktree: Record<string, readonly ChatAddition[]> = {}
const listeners = new Set<() => void>()

function emit(next: Record<string, readonly ChatAddition[]>): void {
  byWorktree = next
  for (const listener of listeners) {
    listener()
  }
}

function rootOf(group: PRCommentGroup): PRComment {
  return group.kind === 'thread' ? group.root : group.comment
}

function quote(comment: PRComment): string {
  return `${comment.author}: ${comment.body.trim()}`
}

/** The text the agent gets for one comment thread: where it is, then each comment in order. */
export function formatPRCommentForChat(group: PRCommentGroup): string {
  const root = rootOf(group)
  const where = root.path ? `${root.path}${root.line ? `:${root.line}` : ''}` : 'the pull request'
  const comments = group.kind === 'thread' ? [group.root, ...group.replies] : [group.comment]
  return [`Pull request comment on ${where}:`, ...comments.map(quote)].join('\n')
}

export function isChatAdditionId(id: string): boolean {
  return id.startsWith(ID_PREFIX)
}

export function addPRCommentsToChat(worktreeId: string, groups: readonly PRCommentGroup[]): void {
  const current = byWorktree[worktreeId] ?? EMPTY
  const known = new Set(current.map((item) => item.id))
  const added = groups
    .map((group): ChatAddition => {
      const root = rootOf(group)
      return {
        id: `${ID_PREFIX}${root.id}`,
        worktreeId,
        filePath: root.path ?? 'PR',
        lineNumber: root.line ?? 0,
        body: root.body,
        createdAt: Date.now(),
        side: 'modified',
        prompt: formatPRCommentForChat(group)
      }
    })
    .filter((item) => !known.has(item.id))
  if (added.length > 0) {
    emit({ ...byWorktree, [worktreeId]: [...current, ...added] })
  }
}

export function removeChatAddition(id: string): void {
  const next: Record<string, readonly ChatAddition[]> = {}
  for (const [worktreeId, items] of Object.entries(byWorktree)) {
    next[worktreeId] = items.filter((item) => item.id !== id)
  }
  emit(next)
}

export function clearChatAdditions(worktreeId: string): void {
  if ((byWorktree[worktreeId] ?? EMPTY).length > 0) {
    emit({ ...byWorktree, [worktreeId]: EMPTY })
  }
}

export function chatAdditions(worktreeId: string | null): readonly ChatAddition[] {
  return worktreeId ? (byWorktree[worktreeId] ?? EMPTY) : EMPTY
}

export function useChatAdditions(worktreeId: string | null): readonly ChatAddition[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => chatAdditions(worktreeId)
  )
}

/** "Add to chat" from the Checks tab: the comments join the on-screen workspace's next message. */
export function addPRCommentsToActiveChat(groups: readonly PRCommentGroup[]): void {
  const worktreeId = useAppStore.getState().activeWorktreeId
  if (worktreeId) {
    addPRCommentsToChat(worktreeId, groups)
  }
}
