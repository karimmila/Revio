import React from 'react'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { agentProjectConfigTrustDialog } from './agent-project-config-trust-prompt'

/**
 * Answers main's question before a chat loads a repository's own agent settings. Only a button
 * is an answer main keeps. Escape or an outside press is "not now": this chat starts without the
 * repository's settings, and a later chat asks again.
 */
export function AgentProjectConfigTrustHost(): null {
  const confirm = useConfirmationDialog()
  React.useEffect(() => {
    const api = window.api?.agentProjectConfig
    return api?.onTrustRequest((request) => {
      let declined = false
      void confirm({
        ...agentProjectConfigTrustDialog(request),
        onCancelClicked: () => {
          declined = true
        }
      })
        .catch(() => false)
        .then((trusted) =>
          api.answerTrustRequest(
            request.requestId,
            trusted ? 'trust' : declined ? 'user-only' : 'dismissed'
          )
        )
        .catch(() => undefined)
    })
  }, [confirm])
  return null
}
