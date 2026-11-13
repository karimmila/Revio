import { readRecord } from '../../app-server/codex-item-field-readers'
import { codexElicitationMode, type CodexElicitationMode } from './codex-mcp-elicitation'
import { codexMcpToolApprovalDecisions } from './codex-mcp-tool-approval'
import { readCodexRequestedPermissions } from './codex-permissions-approval'
import type { CodexApprovalDecision } from './codex-structured-prompt-replies'

export const CODEX_PERMISSIONS_APPROVAL_METHOD = 'item/permissions/requestApproval'
export const CODEX_MCP_ELICITATION_METHOD = 'mcpServer/elicitation/request'

/** What a reply needs beyond the request id, kept with the pending prompt. */
export type CodexPromptReplyContext = {
  offeredDecisions?: readonly CodexApprovalDecision[]
  elicitationMode?: CodexElicitationMode
  /** JSON: the permissions a grant echoes, or the schema a form answer is checked against. */
  replyContext?: string
}

/** Null when the request cannot become a prompt and keeps its safe automatic reply. */
export function codexPromptReplyContext(request: {
  method: string
  params: unknown
}): CodexPromptReplyContext | null {
  if (request.method === CODEX_PERMISSIONS_APPROVAL_METHOD) {
    const permissions = readCodexRequestedPermissions(request.params)
    return permissions
      ? { offeredDecisions: ['accept', 'decline'], replyContext: JSON.stringify(permissions) }
      : null
  }
  if (request.method !== CODEX_MCP_ELICITATION_METHOD) {
    return {}
  }
  const mode = codexElicitationMode(request.params)
  if (mode === 'url') {
    return { offeredDecisions: ['accept', 'cancel'], elicitationMode: mode }
  }
  if (mode === 'form') {
    return {
      elicitationMode: mode,
      replyContext: JSON.stringify(readRecord(request.params).requestedSchema ?? {})
    }
  }
  return { offeredDecisions: codexMcpToolApprovalDecisions(request.params) }
}
