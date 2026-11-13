import React from 'react'
import { translate } from '@/i18n/i18n'
import type { AgentProjectConfigDecision } from '../../../../../shared/agent-project-config-trust'
import type { Repo } from '../../../../../shared/repo-types'
import { RevioSettingRow } from './RevioSettingsRows'

function decisionText(decision: AgentProjectConfigDecision): string {
  return decision === 'trust'
    ? translate(
        'auto.components.revioLayout.settings.agentSettingsTrusted',
        'Trusted: chats load this repository’s hooks, MCP servers and settings.'
      )
    : translate(
        'auto.components.revioLayout.settings.agentSettingsUserOnly',
        'Not trusted: chats run without this repository’s hooks, MCP servers and settings.'
      )
}

/**
 * The answer given to "Trust this repository?", with a way to be asked again. Shown only once an
 * answer is saved: a repository that was never asked, or has no agent settings, has no row.
 */
export function RevioAgentSettingsTrustRow({ repo }: { repo: Repo }): React.JSX.Element | null {
  const [decision, setDecision] = React.useState<AgentProjectConfigDecision | null>(null)
  React.useEffect(() => {
    let live = true
    setDecision(null)
    void window.api.agentProjectConfig
      ?.decision(repo.id)
      .then((saved) => live && setDecision(saved))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [repo.id])
  if (!decision) {
    return null
  }
  return (
    <RevioSettingRow
      label={translate(
        'auto.components.revioLayout.settings.agentSettingsTrust',
        'Repository agent settings'
      )}
      description={decisionText(decision)}
      control={
        <button
          type="button"
          data-revio-settings-button=""
          onClick={() =>
            void window.api.agentProjectConfig
              ?.forget(repo.id)
              .then(() => setDecision(null))
              .catch(() => undefined)
          }
        >
          {translate('auto.components.revioLayout.settings.agentSettingsAskAgain', 'Ask again')}
        </button>
      }
    />
  )
}
