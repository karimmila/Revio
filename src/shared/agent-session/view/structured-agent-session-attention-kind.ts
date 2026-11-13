import { isPlanApprovalSubject } from '../agent-session-approval-subject'
import type { AgentJournalRenderItem } from '../journal/agent-session-journal-types'

export type StructuredAgentSessionAttentionKind = 'question' | 'plan' | 'approval'

export function structuredAgentSessionAttentionKind(
  item: AgentJournalRenderItem | undefined
): StructuredAgentSessionAttentionKind | undefined {
  if (item?.body.kind === 'question') {
    return 'question'
  }
  if (item?.body.kind === 'approval') {
    return isPlanApprovalSubject(item.body.subject) ? 'plan' : 'approval'
  }
  return undefined
}
