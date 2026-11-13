import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRuntimeFileListForWorktree } from '@/components/quick-open-file-list'
import { rankQuickOpenFilesWithHistory } from '@/components/quick-open-history-ranking'
import { useQuickOpenHistory } from '@/lib/quick-open-file-history'
import { findTerminalTabWorktreeId } from './native-chat-file-link'
import { useFileListWorktree } from '@/store/selectors'
import {
  useNativeChatMentionSources,
  type NativeChatMentionSource
} from './native-chat-mention-sources'

const MENTION_FILE_LIMIT = 20
const NO_FILES: readonly string[] = []

export type NativeChatMentionFiles = {
  /** Workspace-relative paths, best match first, after any source ids (see `sources`). */
  files: readonly string[]
  /** Chats, terminals and workspaces the menu offers ahead of files, by their id in `files`. */
  sources?: ReadonlyMap<string, NativeChatMentionSource>
  loading: boolean
  failed: boolean
}

/** `query` is null while no `@` token is open. */
export function useNativeChatMentionFiles(args: {
  query: string | null
  terminalTabId: string
  structuredWorktreeId?: string
}): NativeChatMentionFiles {
  const { query, terminalTabId, structuredWorktreeId } = args
  const enabled = query !== null
  // Closed is the common state, so the tab scan only runs while a token is open.
  const worktreeId = useAppStore((state) =>
    enabled
      ? (structuredWorktreeId ?? findTerminalTabWorktreeId(state.tabsByWorktree, terminalTabId))
      : null
  )
  const worktreePath = useFileListWorktree(worktreeId)?.path ?? null
  const history = useQuickOpenHistory(worktreeId, worktreePath)
  const list = useRuntimeFileListForWorktree({
    enabled,
    worktreeId,
    query: query ?? '',
    recentPaths: history
  })
  const failed = list.loadError !== null
  const sources = useNativeChatMentionSources(query, worktreeId, terminalTabId)

  return useMemo(
    () => ({
      files:
        query === null
          ? NO_FILES
          : [
              ...sources.map((source) => source.id),
              ...rankQuickOpenFilesWithHistory(query, list.files, history)
                .slice(0, MENTION_FILE_LIMIT)
                .map((item) => item.path)
            ],
      ...(sources.length > 0
        ? { sources: new Map(sources.map((source) => [source.id, source])) }
        : {}),
      loading: list.loading,
      failed
    }),
    [failed, history, list.files, list.loading, query, sources]
  )
}
