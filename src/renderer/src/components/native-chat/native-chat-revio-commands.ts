import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { translate } from '@/i18n/i18n'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { revioLayoutActive } from '../revio-layout/revio-root-flags'
import type { StructuredAgentSessionCommandOutcome } from '../../../../shared/agent-session/view/structured-agent-session-composer'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

export type RevioCommandContext = {
  sessionId: string
  target: RuntimeClientTarget
  /** The chat's workspace, whose folder `/add-dir` links folders to. */
  worktreeId: string | null
}

function workspacePathOf(worktreeId: string | null): string | null {
  const state = useAppStore.getState()
  return worktreeId
    ? (findWorktreeById(selectWorktreesByRepo(state), worktreeId)?.path ?? null)
    : null
}

const DONE: StructuredAgentSessionCommandOutcome = { handled: true, accepted: true, error: null }

function refused(error: string): StructuredAgentSessionCommandOutcome {
  return { handled: true, accepted: false, error }
}

/** Adds a folder to a workspace's `/add-dir` list once. */
export function withLinkedDirectory(
  linked: Readonly<Record<string, string[]>> | undefined,
  workspacePath: string,
  folder: string
): Record<string, string[]> {
  const current = linked?.[workspacePath] ?? []
  return {
    ...linked,
    [workspacePath]: current.includes(folder) ? current : [...current, folder]
  }
}

/** `/restart`: the chat's next message retires its agent and starts a fresh one. */
export async function restartRevioChatAgent(
  context: Pick<RevioCommandContext, 'sessionId' | 'target'>
): Promise<boolean> {
  return callStructuredAgentSession<{ requested: true }>(
    context.target,
    'agentSession.restartAgent',
    {
      sessionId: context.sessionId
    }
  )
    .then(() => true)
    .catch(() => false)
}

/**
 * The own chat commands, run by Orca rather than sent to the agent: `/mcp-status` opens
 * the MCP status dialog; `/restart` has the next message start a fresh agent; `/add-dir <path>`
 * links a folder to the workspace and restarts the agent so it can use it, and `/add-dir` alone
 * opens "Link workspaces". Null for anything else.
 */
export function runRevioChatCommand(
  text: string,
  context: RevioCommandContext
): Promise<StructuredAgentSessionCommandOutcome> | null {
  if (!revioLayoutActive()) {
    return null
  }
  const [name, ...rest] = text.trim().split(/\s+/)
  const argument = rest.join(' ').trim()
  switch (name) {
    case '/mcp-status':
      useAppStore.getState().openModal('chat-mcp-status', {
        sessionId: context.sessionId,
        target: context.target
      })
      return Promise.resolve(DONE)
    case '/restart':
      return restartRevioChatAgent(context).then((ok) => {
        if (ok) {
          toast.success(
            translate(
              'components.native-chat.revioCommands.restarted',
              'The agent restarts with your next message.'
            )
          )
        }
        return ok
          ? DONE
          : refused(
              translate(
                'components.native-chat.revioCommands.restartFailed',
                'Could not restart the agent.'
              )
            )
      })
    case '/add-dir': {
      const workspacePath = workspacePathOf(context.worktreeId)
      if (!argument && workspacePath) {
        useAppStore.getState().openModal('chat-link-directories', { ...context })
        return Promise.resolve(DONE)
      }
      if (!argument || !workspacePath) {
        return Promise.resolve(
          refused(
            translate(
              'components.native-chat.revioCommands.addDirUsage',
              'Name a folder: /add-dir <path>'
            )
          )
        )
      }
      const state = useAppStore.getState()
      void state.updateSettings({
        revioLinkedDirectories: withLinkedDirectory(
          state.settings?.revioLinkedDirectories,
          workspacePath,
          argument
        )
      })
      return restartRevioChatAgent(context).then(() => {
        toast.success(
          translate(
            'components.native-chat.revioCommands.dirAdded',
            'Added {{value0}}. The agent can use it from your next message.',
            { value0: argument }
          )
        )
        return DONE
      })
    }
    default:
      return null
  }
}
