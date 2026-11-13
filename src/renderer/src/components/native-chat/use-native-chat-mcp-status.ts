import { useCallback, useEffect, useRef, useState } from 'react'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import type { AgentSessionMcpStatusResult } from '../../../../shared/agent-session/agent-session-mcp-status'
import type { NativeChatAccountUsageModalRequest } from './native-chat-account-usage-modal'

export type NativeChatMcpStatusShown =
  | AgentSessionMcpStatusResult
  | { kind: 'loading' }
  | { kind: 'failed' }

/** The chat's MCP servers, read when `active` turns on and again on `reload`. */
export function useNativeChatMcpStatus(
  request: NativeChatAccountUsageModalRequest | null,
  active: boolean
): { shown: NativeChatMcpStatusShown; reload: () => void } {
  const [shown, setShown] = useState<NativeChatMcpStatusShown>({ kind: 'loading' })
  // Callers rebuild the request object on unrelated renders; only a different chat reloads.
  const requestKey = request ? JSON.stringify([request.sessionId, request.target]) : null
  const latest = useRef(request)
  latest.current = request
  const reload = useCallback(() => {
    const current = latest.current
    if (!current || requestKey === null) {
      return
    }
    setShown({ kind: 'loading' })
    void callStructuredAgentSession<AgentSessionMcpStatusResult>(
      current.target,
      'agentSession.mcpStatus',
      { sessionId: current.sessionId }
    )
      .then(setShown)
      .catch(() => setShown({ kind: 'failed' }))
  }, [requestKey])
  useEffect(() => {
    if (active) {
      reload()
    }
  }, [active, reload])
  return { shown, reload }
}

/** Only Claude reports MCP status, so other agents get no composer MCP control. */
export function nativeChatMcpStatusRequest(
  agent: string,
  request: NativeChatAccountUsageModalRequest
): { mcpStatus: NativeChatAccountUsageModalRequest } | Record<string, never> {
  return agent === 'claude' ? { mcpStatus: request } : {}
}
