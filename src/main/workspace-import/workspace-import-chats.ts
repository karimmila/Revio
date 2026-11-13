import { randomUUID } from 'node:crypto'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { createStructuredAgentSessionForWorktree } from '../runtime/rpc/methods/structured-sessions/creation/structured-agent-session-create'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { createStructuredAgentSessionId } from '../../shared/agent-session/structured-agent-session-create'
import { createStructuredAgentSessionOperationId } from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import type { ImportSourceChat } from '../../shared/workspace-import-types'

const IMPORT_CALLER = { callerKey: 'trusted-local:workspace-import' }

/** `opus-5-5-1m` → `claude-opus-5-5[1m]`; anything else is left to the chat's default model. */
export function claudeModelForImportedChat(model: string | null): string | null {
  const match = model?.match(/^(opus|sonnet|haiku)-(\d+(?:-\d+)?)(-1m)?$/)
  return match ? `claude-${match[1]}-${match[2]}${match[3] ? '[1m]' : ''}` : null
}

export type ImportedChat = { ok: true; sessionId: string } | { ok: false; reason: string }

async function createResumedChat(
  runtime: OrcaRuntimeService,
  worktreeId: string,
  chat: ImportSourceChat,
  model: string | null
): Promise<ImportedChat> {
  const created = await createStructuredAgentSessionForWorktree({
    runtime,
    ensureHost: async () => {
      await runtime.ensureStructuredAgentSessionHost()
      const host = getStructuredAgentSessionHost()
      if (!host) {
        throw new Error('chat host unavailable')
      }
      return host
    },
    caller: IMPORT_CALLER,
    envelope: {
      sessionId: createStructuredAgentSessionId(chat.agent, randomUUID),
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: null,
      payloadFingerprint: ''
    },
    worktree: `id:${worktreeId}`,
    agent: chat.agent,
    activate: false,
    atRest: true,
    resumeFrom: { providerSessionId: chat.providerSessionId },
    ...(model ? { options: { model }, optionsMode: 'replace-model-selection' as const } : {})
  })
  return created.ok
    ? { ok: true, sessionId: created.value.sessionId }
    : { ok: false, reason: created.refusal.code }
}

/** Makes a chat that continues the source conversation, under its title and, when known, its model. */
export async function importChat(
  runtime: OrcaRuntimeService,
  worktreeId: string,
  chat: ImportSourceChat
): Promise<ImportedChat> {
  const model = chat.agent === 'claude' ? claudeModelForImportedChat(chat.model) : null
  let result = await createResumedChat(runtime, worktreeId, chat, model)
  // A model this install does not offer must not cost the chat; it then runs on the default.
  if (!result.ok && model) {
    result = await createResumedChat(runtime, worktreeId, chat, null)
  }
  if (result.ok && chat.title.trim() !== '') {
    await getStructuredAgentSessionHost()?.setUserConversationName(
      result.sessionId,
      chat.title,
      'rename'
    )
  }
  return result
}
