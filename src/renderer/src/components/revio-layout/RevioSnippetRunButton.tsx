import React from 'react'
import { Play, Square } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { revioLayoutActive } from './revio-root-flags'
import {
  isCloudWorkspace,
  isRunnableSnippetLanguage,
  runChatSnippet,
  snippetRunKey,
  stopChatSnippet,
  useChatSnippetRunning
} from './revio-chat-snippet-run'

/** The Run / Stop command action on a shell code block in a chat. */
export function RevioSnippetRunButton({
  code,
  language
}: {
  code: string
  language: string | undefined
}): React.JSX.Element | null {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const enabled =
    worktreeId !== null &&
    code.trim() !== '' &&
    isRunnableSnippetLanguage(language) &&
    revioLayoutActive()
  const key = enabled && worktreeId ? snippetRunKey(worktreeId, code) : null
  const running = useChatSnippetRunning(key)
  if (!enabled || !worktreeId || key === null) {
    return null
  }
  const label = running
    ? translate('auto.components.revioLayout.snippetStop', 'Stop command')
    : isCloudWorkspace(worktreeId)
      ? translate('auto.components.revioLayout.snippetRunCloud', 'Run in cloud workspace')
      : translate('auto.components.revioLayout.snippetRun', 'Run')
  return (
    <button
      type="button"
      data-revio-snippet-run={running ? 'running' : 'idle'}
      onClick={(event) => {
        event.stopPropagation()
        if (running) {
          stopChatSnippet(key)
        } else {
          runChatSnippet(worktreeId, code)
        }
      }}
      aria-label={label}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {running ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
    </button>
  )
}
