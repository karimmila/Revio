import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type {
  McpAgent,
  McpServerEntry,
  McpServerSpec
} from '../../../../../shared/mcp-inventory-types'
import { RevioSettingRow, RevioSettingsGroup, RevioSettingsPage } from './RevioSettingsRows'
import { RevioAgentConfigSync } from './RevioAgentConfigSync'
import { RevioDatadogMcpRow } from './RevioDatadogMcpRow'
import {
  RECOMMENDED_MCP_SERVERS,
  datadogMcpSpec,
  groupMcpServers,
  matchesMcpSearch,
  type McpServerRow
} from './revio-mcp-catalog'

const AGENTS: readonly McpAgent[] = ['claude', 'codex']

function agentLabel(agent: McpAgent): string {
  return agent === 'claude'
    ? translate('auto.components.revioLayout.settings.claudeCode', 'Claude Code')
    : translate('auto.components.revioLayout.settings.codex', 'Codex')
}

function target(spec: McpServerSpec): string {
  return spec.transport === 'http'
    ? (spec.url ?? '')
    : [spec.command, ...(spec.args ?? [])].filter(Boolean).join(' ')
}

function ServerRow({
  row,
  busy,
  onAdd
}: {
  row: McpServerRow
  busy: boolean
  onAdd: (agent: McpAgent, spec: McpServerSpec) => void
}): React.JSX.Element {
  const installed = row.agents.map(agentLabel).join(', ')
  return (
    <RevioSettingRow
      label={row.spec.name}
      description={<code data-revio-settings-path="">{target(row.spec)}</code>}
      hint={
        installed
          ? translate('auto.components.revioLayout.settings.mcpInstalledIn', 'In {{value0}}', {
              value0: installed
            })
          : undefined
      }
      control={
        <>
          {AGENTS.filter((agent) => !row.agents.includes(agent)).map((agent) => (
            <button
              key={agent}
              type="button"
              data-revio-settings-button=""
              disabled={busy}
              onClick={() => onAdd(agent, row.spec)}
            >
              {translate('auto.components.revioLayout.settings.mcpAddTo', 'Add to {{value0}}', {
                value0: agentLabel(agent)
              })}
            </button>
          ))}
        </>
      }
    />
  )
}

/** The MCP servers page for this Mac: what Claude Code and Codex have, and a few to add. */
export function RevioMcpSettings(): React.JSX.Element {
  const api = window.api.agentCredentials
  const [entries, setEntries] = React.useState<McpServerEntry[] | null>(null)
  const [query, setQuery] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    void api
      ?.listMcpServers()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [api])
  const add = (agent: McpAgent, spec: McpServerSpec): void => {
    if (!api) {
      return
    }
    setBusy(true)
    void api
      .addMcpServer(agent, spec)
      .then(setEntries)
      .catch((error: unknown) =>
        toast.error(
          translate(
            'auto.components.revioLayout.settings.mcpAddFailed',
            'Could not add {{value0}}.',
            {
              value0: spec.name
            }
          ),
          { description: extractIpcErrorMessage(error, '') || undefined }
        )
      )
      .finally(() => setBusy(false))
  }
  const installed = groupMcpServers(entries ?? []).filter((row) =>
    matchesMcpSearch(row.spec, query)
  )
  const installedNames = new Set((entries ?? []).map((entry) => entry.name))
  const recommended = RECOMMENDED_MCP_SERVERS.filter(
    (spec) => !installedNames.has(spec.name) && matchesMcpSearch(spec, query)
  ).map((spec) => ({ spec, agents: [] }))
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.mcpServers', 'MCP servers')}
      description={translate(
        'auto.components.revioLayout.settings.mcpPageDescription',
        'Servers Claude Code and Codex load in every workspace. Remote servers sign in with OAuth the first time an agent uses them.'
      )}
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={translate(
          'auto.components.revioLayout.settings.mcpSearch',
          'Search MCP servers...'
        )}
        className="mb-2 h-8"
      />
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.mcpInstalled', 'Installed')}
      />
      {entries === null ? (
        <p data-revio-settings-lede="">
          {translate(
            'auto.components.revioLayout.settings.mcpScanning',
            'Scanning local MCP servers…'
          )}
        </p>
      ) : installed.length === 0 ? (
        <p data-revio-settings-lede="">
          {translate('auto.components.revioLayout.settings.mcpNone', 'No matching MCP servers.')}
        </p>
      ) : (
        installed.map((row) => <ServerRow key={row.spec.name} row={row} busy={busy} onAdd={add} />)
      )}
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.mcpRecommended', 'Recommended')}
      />
      {recommended.map((row) => (
        <ServerRow key={row.spec.name} row={row} busy={busy} onAdd={add} />
      ))}
      {installedNames.has('datadog') || !matchesMcpSearch(datadogMcpSpec('US1'), query) ? null : (
        <RevioDatadogMcpRow agents={AGENTS} busy={busy} onAdd={add} />
      )}
      <RevioAgentConfigSync />
    </RevioSettingsPage>
  )
}
