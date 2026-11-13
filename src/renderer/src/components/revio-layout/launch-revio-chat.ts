import { revioPromptsForWorktree } from './revio-prompts-for-worktree'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { parseRevioReviewModel } from './revio-review-model'
import { revioPrompt, promptForWorkspace } from './revio-prompts'
import { revioTabLimit, revioTabLimitReached } from './revio-tab-limit'
import { workspaceHasNoChanges } from './revio-create-pr-precheck'

/** A new chat with the default agent in Orca's agent UI; the center shows chats only. */
export function launchRevioChat(worktreeId: string, groupId?: string): void {
  launchRevioAgentChat(worktreeId, { groupId })
}

/** A new chat, optionally sent a prompt at once (Review, Create PR, Fix, Resolve), or with the prompt
 * left as its draft ("Edit before sending"). */
export function launchRevioAgentChat(
  worktreeId: string,
  {
    groupId,
    prompt,
    draft = false,
    agent,
    model
  }: { groupId?: string; prompt?: string; draft?: boolean; agent?: TuiAgent; model?: string }
): boolean {
  const state = useAppStore.getState()
  const limit = state.settings ? revioTabLimit(state.settings) : null
  if (revioTabLimitReached(state.unifiedTabsByWorktree[worktreeId] ?? [], limit)) {
    toast.error(
      translate(
        'auto.components.revioLayout.tabLimit',
        'Maximum of {{value0}} tabs allowed per workspace',
        { value0: limit ?? 0 }
      )
    )
    return false
  }
  const defaultAgent = state.settings?.defaultTuiAgent
  const chatAgent = agent ?? (defaultAgent && defaultAgent !== 'blank' ? defaultAgent : 'claude')
  const cloud = isCloudWorkspace(worktreeId)
  const sent = prompt ? promptForWorkspace(prompt, cloud) : undefined
  const launch = (picks: Readonly<Record<string, string>> | undefined): boolean => {
    const result = launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      agent: chatAgent,
      worktreeId,
      ...(picks ? { sessionOptions: picks, chatSessionOptions: picks } : {}),
      ...(groupId ? { groupId } : {}),
      ...(sent
        ? { prompt: sent, promptDelivery: draft ? ('draft' as const) : ('auto-submit' as const) }
        : {}),
      requestedSurface: 'chat'
    })
    if (!result) {
      toast.error(translate('auto.components.revioLayout.chatFailed', 'Could not start a chat.'))
    }
    return Boolean(result)
  }
  if (model) {
    return launch({ model })
  }
  if (cloud) {
    // A cloud workspace's chat reads its sandbox's account default (Sonnet there, Opus here,
    // 2026-11-10), so it gets the model this Mac shows, as the Create card's first chat does.
    void import('@/components/new-workspace/use-composer-chat-options')
      .then((options) => options.resolveComposerLaunchDefaults(chatAgent))
      .catch(() => ({}))
      .then((picks) => launch(Object.keys(picks).length > 0 ? picks : undefined))
    return true
  }
  const saved = state.settings?.nativeChatSessionOptions?.[chatAgent]?.model
  return launch(saved ? { model: saved } : undefined)
}

function isCloudWorkspace(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  return repo ? isCloudRepo(repo, cloudEnvironmentIdsNow()) : false
}

/** The Review (button and ⌘⇧R): the review prompt, on the Review model when one is set. */
export function launchRevioReview(worktreeId: string, draft = false): boolean {
  const settings = useAppStore.getState().settings
  const reviewModel = parseRevioReviewModel(settings?.revioReviewModel)
  return launchRevioAgentChat(worktreeId, {
    prompt: revioPrompt(revioPromptsForWorktree(worktreeId), 'review'),
    draft,
    ...reviewModel
  })
}

/**
 * Review as the button and ⌘⇧R ask for it: a clean branch level with its base has nothing to
 * review, and a review of nothing only spent a chat tab and a model turn, so it says so instead.
 */
export async function requestRevioReview(worktreeId: string, draft = false): Promise<boolean> {
  if (await workspaceHasNoChanges(worktreeId)) {
    toast.message(
      translate('auto.components.revioLayout.noChangesToReview', 'No changes to review')
    )
    return false
  }
  return launchRevioReview(worktreeId, draft)
}
