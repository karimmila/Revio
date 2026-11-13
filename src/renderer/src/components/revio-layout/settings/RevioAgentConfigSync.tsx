import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type { AgentConfigItem, SyncAgent } from '../../../../../shared/agent-config-sync-types'
import { RevioSettingRow, RevioSettingsGroup } from './RevioSettingsRows'

const SYNC_AGENTS: readonly SyncAgent[] = ['claude', 'codex']

function agentName(agent: SyncAgent): string {
  return agent === 'claude'
    ? translate('auto.components.revioLayout.settings.claudeCode', 'Claude Code')
    : translate('auto.components.revioLayout.settings.codex', 'Codex')
}

function ItemRow({
  item,
  busy,
  onCopy
}: {
  item: AgentConfigItem
  busy: boolean
  onCopy: (item: AgentConfigItem, to: SyncAgent, overwrite: boolean) => void
}): React.JSX.Element {
  // An overwrite needs a second press, so a differing copy is never replaced by accident.
  const [confirming, setConfirming] = React.useState<SyncAgent | null>(null)
  const missing: SyncAgent[] = SYNC_AGENTS.filter((agent) => !item.agents.includes(agent))
  const kindLabel =
    item.kind === 'skill'
      ? translate('auto.components.revioLayout.settings.syncSkill', 'Skill')
      : translate('auto.components.revioLayout.settings.syncCommand', 'Slash command')
  return (
    <RevioSettingRow
      label={item.kind === 'command' ? `/${item.name}` : item.name}
      description={`${kindLabel} · ${item.agents.map(agentName).join(', ')}`}
      hint={
        item.same
          ? undefined
          : translate('auto.components.revioLayout.settings.syncDiffers', 'The two copies differ.')
      }
      control={
        <>
          {missing.map((agent) => (
            <button
              key={agent}
              type="button"
              data-revio-settings-button=""
              disabled={busy}
              onClick={() => onCopy(item, agent, false)}
            >
              {translate('auto.components.revioLayout.settings.mcpAddTo', 'Add to {{value0}}', {
                value0: agentName(agent)
              })}
            </button>
          ))}
          {item.same
            ? null
            : item.agents.map((agent) => (
                <button
                  key={agent}
                  type="button"
                  data-revio-settings-button=""
                  data-variant={confirming === agent ? 'destructive' : undefined}
                  disabled={busy}
                  onBlur={() => setConfirming(null)}
                  onClick={() => {
                    if (confirming === agent) {
                      setConfirming(null)
                      onCopy(item, agent, true)
                    } else {
                      setConfirming(agent)
                    }
                  }}
                >
                  {confirming === agent
                    ? translate(
                        'auto.components.revioLayout.settings.syncConfirm',
                        'Replace {{value0}}’s copy?',
                        { value0: agentName(agent) }
                      )
                    : translate(
                        'auto.components.revioLayout.settings.syncOverwrite',
                        'Use the other copy in {{value0}}',
                        { value0: agentName(agent) }
                      )}
                </button>
              ))}
        </>
      }
    />
  )
}

/** "Sync agent configs": skills and slash commands between Claude Code and Codex. */
export function RevioAgentConfigSync(): React.JSX.Element | null {
  const api = window.api.agentCredentials
  const [items, setItems] = React.useState<AgentConfigItem[]>([])
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    void api
      ?.listAgentConfigs()
      .then(setItems)
      .catch(() => setItems([]))
  }, [api])
  if (!api) {
    return null
  }
  const copy = (item: AgentConfigItem, to: SyncAgent, overwrite: boolean): void => {
    setBusy(true)
    void api
      .copyAgentConfig(item.kind, item.name, to, overwrite)
      .then(setItems)
      .catch((error: unknown) =>
        toast.error(
          translate(
            'auto.components.revioLayout.settings.syncFailed',
            'Could not copy {{value0}}.',
            {
              value0: item.name
            }
          ),
          { description: extractIpcErrorMessage(error, '') || undefined }
        )
      )
      .finally(() => setBusy(false))
  }
  const open = items.filter((item) => item.agents.length < 2 || !item.same)
  return (
    <>
      <RevioSettingsGroup
        title={translate(
          'auto.components.revioLayout.settings.syncAgentConfigs',
          'Sync agent configs'
        )}
      />
      {open.length === 0 ? (
        <p data-revio-settings-lede="">
          {translate(
            'auto.components.revioLayout.settings.syncInSync',
            'Claude Code and Codex have the same skills and slash commands.'
          )}
        </p>
      ) : (
        open.map((item) => (
          <ItemRow key={`${item.kind}:${item.name}`} item={item} busy={busy} onCopy={copy} />
        ))
      )}
    </>
  )
}
