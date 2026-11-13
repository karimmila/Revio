import { randomUUID } from 'node:crypto'
import type { ImportSourceMessageRow } from './import-source-rows'

type SdkLine = {
  type?: unknown
  uuid?: unknown
  message?: unknown
  timestamp?: unknown
  parent_tool_use_id?: unknown
}

function parseSdkLine(content: string): SdkLine | null {
  try {
    const parsed: unknown = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * A cloud chat's CLI transcript stayed on the source app's VM; only its message stream reached this
 * Mac. Rebuilds a Claude Code transcript from that stream so `--resume` and the history import can
 * read it: typed prompts become user lines, top-level assistant and tool-result events keep their
 * ids, and every line links to the one before. Subagent events and status events are left out, as
 * the main conversation never refers to them by id.
 */
export function synthesizeClaudeTranscript(input: {
  rows: readonly ImportSourceMessageRow[]
  sessionId: string
  cwd: string
  gitBranch: string | null
  randomId?: () => string
}): string {
  const newId = input.randomId ?? randomUUID
  const lines: string[] = []
  let parentUuid: string | null = null
  const push = (
    type: 'user' | 'assistant',
    uuid: string,
    message: unknown,
    timestamp: string
  ): void => {
    lines.push(
      JSON.stringify({
        parentUuid,
        isSidechain: false,
        userType: 'external',
        cwd: input.cwd,
        sessionId: input.sessionId,
        ...(input.gitBranch ? { gitBranch: input.gitBranch } : {}),
        type,
        message,
        uuid,
        timestamp
      })
    )
    parentUuid = uuid
  }
  for (const row of input.rows) {
    const fallbackTime = row.createdAt ?? new Date(0).toISOString()
    if (row.role === 'user') {
      if (row.content.trim() !== '') {
        push('user', newId(), { role: 'user', content: row.content }, fallbackTime)
      }
      continue
    }
    const event = parseSdkLine(row.content)
    if (
      !event ||
      (event.type !== 'assistant' && event.type !== 'user') ||
      event.parent_tool_use_id ||
      !event.message
    ) {
      continue
    }
    push(
      event.type,
      typeof event.uuid === 'string' ? event.uuid : newId(),
      event.message,
      typeof event.timestamp === 'string' ? event.timestamp : fallbackTime
    )
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}
