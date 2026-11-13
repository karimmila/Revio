import { revioPromptsForWorktree } from './revio-prompts-for-worktree'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { requestRevioPullRequestFromKey } from './RevioCreatePrButton'
import { mergeRevioPullRequest, type MergeablePr } from './RevioMergeButton'
import { commitAndPushWithAgent, requestRevioGitAction } from './revio-git-actions'
import { launchRevioAgentChat } from './launch-revio-chat'
import { revioPrompt } from './revio-prompts'
import { openRevioPullRequest } from './open-revio-pull-request'
import type { PrAction } from './revio-pr-status'

type GitKeyContext = {
  worktreeId: string | null
  pr: { url: string } | null
  status: PrAction
  mergeable: MergeablePr | null
  subject: string
}

/**
 * The git keys (its 0.92 registry), acting on the PR bar's workspace: ⌘⇧P Create PR,
 * ⌘⇧Y Commit and push, ⌘⇧L Pull latest from main, ⌘⇧M Merge (when ready), ⌘⇧X Fix errors
 * (when checks fail), ⌘⇧G Open the PR.
 */
export function useRevioGitKeys(context: GitKeyContext): void {
  const latest = useRef(context)
  latest.current = context
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey || !event.shiftKey || event.altKey || event.ctrlKey) {
        return
      }
      const { worktreeId, pr, status, mergeable, subject } = latest.current
      const state = useAppStore.getState()
      if (!worktreeId || state.activeView === 'settings') {
        return
      }
      const run = ((): (() => void) | null => {
        switch (event.code) {
          case 'KeyP':
            return pr ? null : () => requestRevioPullRequestFromKey(worktreeId)
          case 'KeyY':
            return () => commitAndPushWithAgent(worktreeId)
          case 'KeyL':
            return () => requestRevioGitAction('rebase_base')
          case 'KeyM':
            return mergeable ? () => void mergeRevioPullRequest(mergeable) : null
          case 'KeyX':
            return status === 'fixErrors'
              ? () =>
                  launchRevioAgentChat(worktreeId, {
                    prompt: subject + revioPrompt(revioPromptsForWorktree(worktreeId), 'fixErrors')
                  })
              : null
          case 'KeyG':
            return pr ? () => openRevioPullRequest(pr.url) : null
          default:
            return null
        }
      })()
      if (run) {
        event.preventDefault()
        event.stopPropagation()
        run()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
