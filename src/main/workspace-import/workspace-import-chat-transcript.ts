import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { ImportSourceChat, ImportSourceWorkspace } from '../../shared/workspace-import-types'
import type { ImportSourceSnapshot } from './import-source-database'
import {
  findClaudeTranscript,
  placeClaudeTranscriptForResume,
  writeClaudeTranscriptForResume
} from './import-source-transcripts'
import { synthesizeClaudeTranscript } from './import-source-transcript-synthesis'
import { importChat } from './workspace-import-chats'

export type ChatImportOutcome =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'transcript-missing' | 'chat-failed' }

/**
 * Puts the conversation where the chat's Claude finds it, then makes the chat. A transcript on
 * this Mac is copied; a cloud chat's is rebuilt from the messages the source app stored.
 */
export async function importChatWithTranscript(input: {
  runtime: OrcaRuntimeService
  snapshot: ImportSourceSnapshot
  source: ImportSourceWorkspace
  chat: ImportSourceChat
  worktreeId: string
  worktreePath: string
  sourceHome: string
  targetHome: string
}): Promise<ChatImportOutcome> {
  const { chat } = input
  if (chat.agent === 'claude') {
    const target = {
      sessionId: chat.providerSessionId,
      targetHome: input.targetHome,
      workspacePath: input.worktreePath
    }
    const existing = await findClaudeTranscript(
      input.sourceHome,
      input.source.path,
      chat.providerSessionId
    )
    if (existing) {
      await placeClaudeTranscriptForResume({
        ...target,
        sourceFile: existing,
        sourceCwd: input.source.path
      })
    } else {
      const contents = synthesizeClaudeTranscript({
        rows: input.snapshot.readChatMessages(input.source, chat.sourceId),
        sessionId: chat.providerSessionId,
        cwd: input.worktreePath,
        gitBranch: input.source.branch
      })
      if (contents === '') {
        return { ok: false, reason: 'transcript-missing' }
      }
      await writeClaudeTranscriptForResume({ ...target, contents })
    }
  }
  try {
    const created = await importChat(input.runtime, input.worktreeId, chat)
    if (created.ok) {
      return created
    }
    console.warn('[workspace-import] chat not created:', created.reason)
  } catch (error) {
    console.warn('[workspace-import] chat not created:', error)
  }
  return { ok: false, reason: 'chat-failed' }
}
