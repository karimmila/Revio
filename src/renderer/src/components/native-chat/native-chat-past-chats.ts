import type { AiVaultSession } from '../../../../shared/ai-vault/contracts/ai-vault-types'

export const PAST_CHAT_OFFERS = 3

/** This workspace's newest past chats (Session History), the ones an empty chat offers to attach. */
type PastChatFields = Pick<AiVaultSession, 'cwd' | 'cwdAliases' | 'messageCount' | 'modifiedAt'>

export function pastChatsForWorkspace<T extends PastChatFields>(
  sessions: readonly T[],
  workspacePath: string,
  limit = PAST_CHAT_OFFERS
): T[] {
  const here = (session: T): boolean =>
    session.cwd === workspacePath || (session.cwdAliases ?? []).includes(workspacePath)
  return sessions
    .filter((session) => here(session) && session.messageCount > 0)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit)
}

/** What attaching a past chat puts in the prompt: its title and transcript file, for the agent to read. */
export function pastChatAttachmentText(
  session: Pick<AiVaultSession, 'title' | 'filePath'>
): string {
  return `Earlier chat "${session.title}" — transcript: ${session.filePath} `
}
