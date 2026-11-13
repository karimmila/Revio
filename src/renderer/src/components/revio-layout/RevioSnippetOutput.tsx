import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { revioLayoutActive } from './revio-root-flags'
import {
  isRunnableSnippetLanguage,
  snippetRunKey,
  useChatSnippetRunning
} from './revio-chat-snippet-run'
import { clearChatSnippetOutput, useChatSnippetOutput } from './revio-chat-snippet-output'

/** The inline output under a run shell code block, with "Clear output". */
export function RevioSnippetOutput({
  code,
  language
}: {
  code: string
  language: string | undefined
}): React.JSX.Element | null {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const key =
    worktreeId !== null && isRunnableSnippetLanguage(language) && revioLayoutActive()
      ? snippetRunKey(worktreeId, code)
      : null
  const output = useChatSnippetOutput(key, code)
  const running = useChatSnippetRunning(key)
  if (key === null || output === null || (output === '' && !running)) {
    return null
  }
  const clear = translate('auto.components.revioLayout.snippetClearOutput', 'Clear output')
  return (
    <div data-revio-snippet-output className="border-t border-chat-code-border">
      <div className="flex h-7 items-center justify-between px-3">
        <span className="font-sans text-xs text-chat-foreground-faint">
          {translate('auto.components.revioLayout.snippetOutput', 'Output')}
        </span>
        {running ? null : (
          <button
            type="button"
            onClick={() => clearChatSnippetOutput(key)}
            className="rounded-md px-1.5 font-sans text-xs text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {clear}
          </button>
        )}
      </div>
      <pre className="scrollbar-sleek m-0 max-h-60 overflow-y-auto whitespace-pre-wrap px-3.5 pb-3 font-mono text-chat-code text-chat-code-foreground [overflow-wrap:anywhere]">
        {output}
      </pre>
    </div>
  )
}
