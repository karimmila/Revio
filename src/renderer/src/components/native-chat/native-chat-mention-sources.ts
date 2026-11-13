import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/structured-agent-session-status-feed'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { revioLayoutActive } from '@/components/revio-layout/revio-root-flags'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { toHostSessionPaneKey } from '../../../../shared/workspace-layout/terminal-surface-id'
import { nativeChatTranscriptCopyText } from '../../../../shared/native-chat/transcript/native-chat-transcript-copy'
import type {
  RuntimeTerminalRead,
  RuntimeTerminalResolvePane
} from '../../../../shared/runtime-terminal-contracts'
import type { Tab } from '../../../../shared/tab-types'
import { nativeChatTabActions } from './native-chat-tab-actions'

/** Mention menu entries that are not files carry this prefix in the menu's id list. */
const PREFIX = 'orca-mention:'
const PER_KIND = 4
const TERMINAL_LINES = 200

export type NativeChatMentionSource = {
  id: string
  kind: 'chat' | 'terminal' | 'workspace'
  label: string
  detail: string
}

export function isNativeChatMentionSourceId(value: string): boolean {
  return value.startsWith(PREFIX)
}

function isSource(value: unknown): value is NativeChatMentionSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'kind' in value &&
    'label' in value &&
    typeof value.id === 'string' &&
    typeof value.label === 'string'
  )
}

function tabSources(
  state: AppState,
  worktreeId: string,
  currentTabId: string
): NativeChatMentionSource[] {
  return (state.unifiedTabsByWorktree[worktreeId] ?? []).flatMap(
    (tab): NativeChatMentionSource[] => {
      if (tab.id === currentTabId || tab.entityId === currentTabId) {
        return []
      }
      if (isStructuredTab(tab)) {
        return [{ id: `${PREFIX}chat:${tab.id}`, kind: 'chat', label: tab.label, detail: '' }]
      }
      return tab.contentType === 'terminal'
        ? [{ id: `${PREFIX}terminal:${tab.id}`, kind: 'terminal', label: tab.label, detail: '' }]
        : []
    }
  )
}

function workspaceSources(state: AppState, worktreeId: string): NativeChatMentionSource[] {
  return Object.values(selectWorktreesByRepo(state))
    .flat()
    .filter((worktree) => worktree.id !== worktreeId && !worktree.isMainWorktree)
    .map((worktree) => ({
      id: `${PREFIX}workspace:${worktree.id}`,
      kind: 'workspace' as const,
      label: worktree.displayName,
      detail: worktree.branch.replace(/^refs\/heads\//u, '')
    }))
}

/**
 * The other @ sources: this workspace's chats and terminals, and the other workspaces,
 * matched by name. Only the workspace layout offers them; files stay Orca's own @ menu.
 */
export function useNativeChatMentionSources(
  query: string | null,
  worktreeId: string | null,
  currentTabId: string
): readonly NativeChatMentionSource[] {
  const enabled = query !== null && worktreeId !== null && revioLayoutActive()
  // Selected as strings: fresh objects would never compare equal and would re-render forever.
  const rows = useAppStore(
    useShallow((state) =>
      enabled && worktreeId
        ? [
            ...tabSources(state, worktreeId, currentTabId),
            ...workspaceSources(state, worktreeId)
          ].map((source) => JSON.stringify(source))
        : []
    )
  )
  return useMemo(() => {
    const sources = rows.flatMap((row): NativeChatMentionSource[] => {
      const parsed: unknown = JSON.parse(row)
      return isSource(parsed) ? [parsed] : []
    })
    const needle = (query ?? '').toLowerCase()
    const counts = new Map<string, number>()
    return sources.filter((source) => {
      const count = counts.get(source.kind) ?? 0
      const hit = `${source.label} ${source.detail}`.toLowerCase().includes(needle)
      if (!hit || count >= PER_KIND) {
        return false
      }
      counts.set(source.kind, count + 1)
      return true
    })
  }, [query, rows])
}

function findTab(state: AppState, tabId: string): Tab | null {
  for (const tabs of Object.values(state.unifiedTabsByWorktree)) {
    const tab = tabs.find((entry) => entry.id === tabId)
    if (tab) {
      return tab
    }
  }
  return null
}

function chatContext(state: AppState, tab: Tab): string | null {
  const mounted = nativeChatTabActions(tab.id)
  const transcript = mounted ? nativeChatTranscriptCopyText(mounted.items(), 'concise') : ''
  if (transcript) {
    return `the chat "${tab.label}":\n\n<chat>\n${transcript}\n</chat>\n`
  }
  const target = structuredAgentSessionTargetForHost(structuredAgentSessionOwnerForTab(state, tab))
  const path = target
    ? getStructuredAgentSessionStatusFeed(target).getSnapshot().get(tab.entityId)?.providerSession
        ?.transcriptPath
    : undefined
  return path ? `the chat "${tab.label}" (its transcript is at ${path})` : null
}

async function terminalContext(state: AppState, tab: Tab): Promise<string | null> {
  const target = structuredAgentSessionTargetForHost(structuredAgentSessionOwnerForTab(state, tab))
  const leaf = Object.keys(state.terminalLayoutsByTabId[tab.entityId]?.ptyIdsByLeafId ?? {}).at(0)
  if (!target || !leaf) {
    return null
  }
  const { terminal } = await callRuntimeRpc<{ terminal: RuntimeTerminalResolvePane }>(
    target,
    'terminal.resolvePane',
    { paneKey: toHostSessionPaneKey(`${tab.entityId}:${leaf}`), worktreeId: tab.worktreeId }
  )
  const { terminal: read } = await callRuntimeRpc<{ terminal: RuntimeTerminalRead }>(
    target,
    'terminal.read',
    { terminal: terminal.handle, limit: TERMINAL_LINES }
  )
  // Screen rows pad the prompt with blank lines; keep at most one between output lines.
  const output = read.tail
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  return output ? `the output of terminal "${tab.label}":\n\n\`\`\`\n${output}\n\`\`\`\n` : null
}

/** The text a chosen source puts in the draft, or null when it has nothing to give. */
export async function resolveNativeChatMentionSource(id: string): Promise<string | null> {
  const [kind, ...rest] = id.slice(PREFIX.length).split(':')
  const key = rest.join(':')
  const state = useAppStore.getState()
  try {
    if (kind === 'workspace') {
      const worktree = Object.values(selectWorktreesByRepo(state))
        .flat()
        .find((entry) => entry.id === key)
      const branch = worktree?.branch.replace(/^refs\/heads\//u, '')
      return worktree
        ? `the workspace "${worktree.displayName}" at ${worktree.path}${branch ? ` (branch ${branch})` : ''}`
        : null
    }
    const tab = findTab(state, key)
    const text = !tab
      ? null
      : kind === 'chat'
        ? chatContext(state, tab)
        : await terminalContext(state, tab)
    if (text === null) {
      toast.error(
        translate('auto.components.nativeChat.mentionUnavailable', 'Nothing to mention from it yet')
      )
    }
    return text
  } catch {
    toast.error(
      translate('auto.components.nativeChat.mentionUnavailable', 'Nothing to mention from it yet')
    )
    return null
  }
}
