import React from 'react'
import { translate } from '@/i18n/i18n'
import type { McpAgent, McpServerSpec } from '../../../../../shared/mcp-inventory-types'
import { RevioSelect, RevioSettingRow } from './RevioSettingsRows'
import { DATADOG_MCP_SITES, datadogMcpSpec, type DatadogSite } from './revio-mcp-catalog'

/**
 * "Connect Datadog": Datadog's MCP server lives at a per-site address, so pick the
 * site first; the agent signs in with OAuth the first time it uses it.
 */
export function RevioDatadogMcpRow({
  agents,
  busy,
  onAdd
}: {
  /** Agents that can still get it. */
  agents: readonly McpAgent[]
  busy: boolean
  onAdd: (agent: McpAgent, spec: McpServerSpec) => void
}): React.JSX.Element {
  const [site, setSite] = React.useState<DatadogSite>('US1')
  const label = translate('auto.components.revioLayout.settings.datadogSite', 'Datadog site')
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.connectDatadog', 'Connect Datadog')}
      description={translate(
        'auto.components.revioLayout.settings.connectDatadogDescription',
        "Pick your Datadog site. The first time an agent uses it, it signs in with Datadog's OAuth."
      )}
      control={
        <>
          <RevioSelect
            label={label}
            value={site}
            options={DATADOG_MCP_SITES.map((entry) => ({ value: entry.site, label: entry.site }))}
            onChange={setSite}
          />
          {agents.map((agent) => (
            <button
              key={agent}
              type="button"
              data-revio-settings-button=""
              disabled={busy}
              onClick={() => onAdd(agent, datadogMcpSpec(site))}
            >
              {translate('auto.components.revioLayout.settings.mcpAddTo', 'Add to {{value0}}', {
                value0: agent === 'claude' ? 'Claude Code' : 'Codex'
              })}
            </button>
          ))}
        </>
      }
    />
  )
}
