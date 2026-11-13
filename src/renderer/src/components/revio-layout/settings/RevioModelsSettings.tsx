import React from 'react'
import { RevioAgentStyleRows } from './RevioAgentStyleRows'
import { translate } from '@/i18n/i18n'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { enqueueSessionOptionSettingsWrite } from '@/components/native-chat/native-chat-session-option-settings-write'
import { getAgentSessionOptionCatalog } from '../../../../../shared/agent-session/options/agent-session-option-catalog'
import type {
  AgentSessionModelCatalogResult,
  AgentSessionOptionChoice
} from '../../../../../shared/agent-session/agent-session-wire'
import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'
import { RevioSelect, RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import { revioChatAgent, decodeDefaultModel, encodeDefaultModel } from './revio-default-model'

const LOCAL = { kind: 'local' } as const
type AgentRow = { agent: TuiAgent; label: string }
function agentRows(): [AgentRow, AgentRow, AgentRow] {
  return [
    {
      agent: 'claude',
      label: translate('auto.components.revioLayout.settings.claudeCode', 'Claude Code')
    },
    { agent: 'codex', label: translate('auto.components.revioLayout.settings.codex', 'Codex') },
    {
      agent: 'cursor',
      label: translate('auto.components.revioLayout.settings.cursor', 'Cursor')
    }
  ]
}

type ModelRow = {
  id: string
  label: string
  isDefault: boolean
  efforts: AgentSessionOptionChoice[]
  /** What the agent runs when no effort is sent. */
  defaultEffort?: string
}

/** The static list Orca ships, replaced by the host's live listing once it answers. */
function staticModels(agent: AgentType): ModelRow[] {
  return (getAgentSessionOptionCatalog(agent)?.models ?? []).map((model) => {
    const effort = model.options.find((option) => option.id === 'effort')
    return {
      id: model.id,
      label: model.label,
      isDefault: model.isDefault === true,
      efforts: effort?.kind.type === 'select' ? effort.kind.choices : [],
      ...(effort?.kind.type === 'select' ? { defaultEffort: effort.kind.defaultValue } : {})
    }
  })
}

/**
 * The models for an agent and whether the host has answered. Until it does, the static list can
 * lack the saved model, so a row shown early would flash the static default (Sonnet for Claude).
 */
function useModelListing(agent: AgentType): { models: ModelRow[]; loaded: boolean } {
  const [models, setModels] = React.useState(() => staticModels(agent))
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    let live = true
    void callStructuredAgentSession<AgentSessionModelCatalogResult>(
      LOCAL,
      'agentSession.modelCatalog',
      { agent, waitForListing: true }
    )
      .finally(() => live && setLoaded(true))
      .then((answer) => {
        if (live && answer.origin !== 'unknown' && answer.models.length > 0) {
          setModels(
            answer.models.map((model) => ({
              id: model.id,
              label: model.label,
              isDefault: model.isDefault,
              efforts: model.efforts,
              ...(model.defaultEffort ? { defaultEffort: model.defaultEffort } : {})
            }))
          )
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [agent])
  return { models, loaded }
}

function useModels(agent: AgentType): ModelRow[] {
  return useModelListing(agent).models
}

/** A select-sized placeholder while the model listing loads. */
function SelectSkeleton(): React.JSX.Element {
  return <div aria-hidden className="h-7 w-36 animate-pulse rounded-md bg-muted" />
}

function savedModelId(settings: GlobalSettings, agent: AgentType, models: ModelRow[]): string {
  return (
    settings.nativeChatSessionOptions?.[agent]?.model ??
    models.find((model) => model.isDefault)?.id ??
    models[0]?.id ??
    ''
  )
}

function AgentModelRow({
  agent,
  label,
  models,
  loaded
}: {
  agent: AgentType
  label: string
  models: ModelRow[]
  loaded: boolean
}): React.JSX.Element {
  const { settings } = useRevioSettings()
  const saved = settings.nativeChatSessionOptions?.[agent]
  const modelId = savedModelId(settings, agent, models)
  const model = models.find((candidate) => candidate.id === modelId)
  const effort = saved?.valuesByModel?.[modelId]?.effort
  const write = (picks: { modelId: string; optionId: string; value: string }[]): void => {
    void enqueueSessionOptionSettingsWrite(LOCAL, { type: 'apply-picks', agent, picks })
  }
  if (!loaded) {
    return <RevioSettingRow label={label} control={<SelectSkeleton />} />
  }
  if (models.length === 0) {
    return <RevioSettingRow label={label} />
  }
  return (
    <RevioSettingRow
      label={label}
      control={
        <>
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.model', '{{value0}} model', {
              value0: label
            })}
            value={modelId}
            options={models.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
            onChange={(next) => write([{ modelId: next, optionId: 'model', value: next }])}
          />
          {model && model.efforts.length > 0 ? (
            <RevioSelect
              label={translate('auto.components.revioLayout.settings.effort', '{{value0}} effort', {
                value0: label
              })}
              value={
                typeof effort === 'string'
                  ? effort
                  : (model.defaultEffort ?? model.efforts[0]?.value ?? '')
              }
              options={model.efforts.map((choice) => ({
                value: choice.value,
                label: choice.label
              }))}
              onChange={(next) => write([{ modelId, optionId: 'effort', value: next }])}
            />
          ) : null}
        </>
      }
    />
  )
}

/** One list across agents, as the "Default model": picking a model also picks its agent. */
function DefaultModelRow({
  rows
}: {
  rows: { agent: TuiAgent; label: string; models: ModelRow[]; loaded: boolean }[]
}): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const agents = rows.map((row) => row.agent)
  const agent = revioChatAgent(settings.defaultTuiAgent, agents)
  const current = rows.find((row) => row.agent === agent)
  const value = current
    ? encodeDefaultModel({ agent, modelId: savedModelId(settings, agent, current.models) })
    : ''
  const label = translate('auto.components.revioLayout.settings.defaultModel', 'Default model')
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.defaultModelDescription',
        'Model for new chats'
      )}
      control={
        current && !current.loaded ? (
          <SelectSkeleton />
        ) : (
          <RevioSelect
            label={label}
            value={value}
            options={rows.flatMap((row) =>
              row.models.map((model) => ({
                value: encodeDefaultModel({ agent: row.agent, modelId: model.id }),
                label: `${row.label} · ${model.label}`
              }))
            )}
            onChange={(next) => {
              const pick = decodeDefaultModel(next, agents)
              if (!pick) {
                return
              }
              update({ defaultTuiAgent: pick.agent })
              void enqueueSessionOptionSettingsWrite(LOCAL, {
                type: 'apply-picks',
                agent: pick.agent,
                picks: [{ modelId: pick.modelId, optionId: 'model', value: pick.modelId }]
              })
            }}
          />
        )
      }
    />
  )
}

const DEFAULT_REVIEW_MODEL = 'default'

/** "Review model": which agent and model the Review button and ⌘⇧R start. */
function ReviewModelRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [claude, codex, cursor] = agentRows()
  const groups = [
    { row: claude, models: useModels(claude.agent) },
    { row: codex, models: useModels(codex.agent) },
    { row: cursor, models: useModels(cursor.agent) }
  ]
  const options = [
    {
      value: DEFAULT_REVIEW_MODEL,
      label: translate('auto.components.revioLayout.settings.reviewModelDefault', 'Default')
    },
    ...groups.flatMap(({ row, models }) =>
      models.map((model) => ({
        value: `${row.agent}:${model.id}`,
        label: `${row.label} · ${model.label}`
      }))
    )
  ]
  const saved = settings.revioReviewModel
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.reviewModel', 'Review model')}
      description={translate(
        'auto.components.revioLayout.settings.reviewModelDescription',
        'The model Review uses. Default starts your default agent with its default model.'
      )}
      control={
        <RevioSelect
          label={translate('auto.components.revioLayout.settings.reviewModel', 'Review model')}
          value={
            saved && options.some((option) => option.value === saved) ? saved : DEFAULT_REVIEW_MODEL
          }
          options={options}
          onChange={(next) =>
            update({ revioReviewModel: next === DEFAULT_REVIEW_MODEL ? '' : next })
          }
        />
      }
    />
  )
}

export function RevioModelsSettings(): React.JSX.Element {
  const [claude, codex, cursor] = agentRows()
  const rows = [
    { ...claude, ...useModelListing(claude.agent) },
    { ...codex, ...useModelListing(codex.agent) },
    { ...cursor, ...useModelListing(cursor.agent) }
  ]
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.models', 'Default models')}
      description={translate(
        'auto.components.revioLayout.settings.modelsDescription',
        'The model and effort a new chat starts with. Picking one in a chat updates it here too.'
      )}
    >
      <DefaultModelRow rows={rows} />
      {rows.map(({ agent, label, models, loaded }) => (
        <AgentModelRow key={agent} agent={agent} label={label} models={models} loaded={loaded} />
      ))}
      <ReviewModelRow />
      <RevioAgentStyleRows />
    </RevioSettingsPage>
  )
}
