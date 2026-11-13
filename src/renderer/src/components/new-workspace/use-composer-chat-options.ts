import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { structuredAgentSessionTargetForHost } from '@/runtime/structured-agent-session-owner'
import { firstFrameOptionState } from '@/components/native-chat/structured-agent-session-option-first-frame'
import { structuredAgentSessionSeedCatalog } from '../../../../shared/agent-session/options/structured-agent-session-seed-catalog'
import {
  applyStructuredAgentSessionModelCatalog,
  type StructuredAgentSessionOptionState
} from '../../../../shared/agent-session/options/structured-agent-session-options'
import {
  structuredAgentSessionOptionView,
  structuredAgentSessionShownSnapshot
} from '../../../../shared/agent-session/options/structured-agent-session-option-view'
import { encodeStructuredAgentSessionOptionValue } from '../../../../shared/agent-session/options/structured-agent-session-option-codec'
import { cachedModelListing, rememberModelListing } from './composer-model-listing-cache'
import { structuredLaunchSeedOptions } from '../../../../shared/native-chat/input/native-chat-session-option-defaults'
import type { AgentSessionModelCatalogResult } from '../../../../shared/agent-session/agent-session-wire'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { cloudSandboxChatPermissionSettings } from '../../../../shared/cloud/cloud-sandbox-chat-permission'
import type { SessionOptionsSurface } from '../../../../shared/native-chat/input/native-chat-session-options'

/** Picks made in the Create dialog, by agent: a new agent starts from its own defaults. */
type ComposerChatPicks = { agent: TuiAgent | null; values: Readonly<Record<string, string>> }

const NO_PICKS: Readonly<Record<string, string>> = {}

/**
 * The model, effort and other launch options the Create dialog's pill offers for the new
 * workspace's first chat, in the same snapshot and surface shape the chat composer's picker
 * reads. It shows the saved default (Settings, Models) until a pick. Models are listed from this
 * Mac: a cloud workspace has no sandbox to ask until it is created.
 */
export function useComposerChatOptions(agent: TuiAgent | null): {
  surface: SessionOptionsSurface
  snapshot: ReturnType<typeof structuredAgentSessionShownSnapshot>
  picks: Readonly<Record<string, string>>
  /** The model and effort the pill shows, picked or not. */
  shown: Readonly<Record<string, string>>
} {
  const target = useMemo(() => structuredAgentSessionTargetForHost('local'), [])
  const settings = useAppStore((s) => s.settings)
  const [picks, setPicks] = useState<ComposerChatPicks>({ agent, values: {} })
  const held = picks.agent === agent ? picks.values : NO_PICKS
  const [catalog, setCatalog] = useState<{
    agent: TuiAgent
    state: StructuredAgentSessionOptionState
  } | null>(null)
  const [demand, setDemand] = useState(0)
  const seed = useMemo(
    () =>
      agent && target
        ? firstFrameOptionState(agent, target, { newLaunch: true, seedsModel: true })
        : null,
    [agent, target]
  )
  // Before this run's listing arrives, the last one this Mac saw names the models.
  const cachedState = useMemo(() => {
    const cached = agent ? cachedModelListing(agent) : null
    return agent && seed && cached
      ? applyStructuredAgentSessionModelCatalog(
          seed,
          structuredAgentSessionSeedCatalog(agent),
          cached,
          { newLaunch: true }
        )
      : seed
  }, [agent, seed])
  useEffect(() => {
    if (!agent || !target || !seed) {
      return
    }
    let current = true
    let settled = false
    const read = (waitForListing: boolean): void => {
      void callStructuredAgentSession<AgentSessionModelCatalogResult>(
        target,
        'agentSession.modelCatalog',
        { agent, waitForListing }
      )
        .then((answer) => {
          // The quick read serves the host's last listing of any age; the waiting one replaces it.
          if (answer.origin === 'unknown' || (settled && !waitForListing)) {
            return
          }
          settled ||= waitForListing
          rememberModelListing(agent, answer)
          if (current) {
            setCatalog({
              agent,
              state: applyStructuredAgentSessionModelCatalog(
                seed,
                structuredAgentSessionSeedCatalog(agent),
                answer,
                { newLaunch: true }
              )
            })
          }
        })
        .catch(() => {})
    }
    read(false)
    read(true)
    return () => {
      current = false
    }
  }, [agent, demand, seed, target])
  const state = catalog?.agent === agent ? catalog.state : cachedState
  // A cloud workspace's sandbox starts its chats with full access; show what it will run with.
  const defaults = useMemo(
    () =>
      agent
        ? structuredLaunchSeedOptions(
            settings?.revioLocation === 'cloud'
              ? cloudSandboxChatPermissionSettings(settings)
              : settings,
            agent
          )
        : undefined,
    [agent, settings]
  )
  const snapshot = useMemo(
    () =>
      state
        ? structuredAgentSessionShownSnapshot(
            structuredAgentSessionOptionView(state, defaults, held)
          )
        : [],
    [defaults, held, state]
  )
  const surface = useMemo<SessionOptionsSurface>(
    () => ({
      getSnapshot: () => snapshot,
      demandModelCatalog: () => setDemand((count) => count + 1),
      setOption: async (id, value) => {
        const encoded = encodeStructuredAgentSessionOptionValue(id, value)
        if (encoded !== null && snapshot.some((option) => option.id === id && option.settable)) {
          setPicks((current) => ({
            agent,
            values: { ...(current.agent === agent ? current.values : {}), [id]: encoded }
          }))
        }
        return { snapshot }
      },
      invokeAction: async () => ({ snapshot }),
      subscribe: () => () => {}
    }),
    [agent, snapshot]
  )
  const shown = useMemo(() => {
    const values: Record<string, string> = {}
    for (const option of snapshot) {
      if (
        (option.id === 'model' || option.id === 'effort') &&
        option.kind.type === 'select' &&
        option.kind.currentValue
      ) {
        const encoded = encodeStructuredAgentSessionOptionValue(option.id, option.kind.currentValue)
        if (encoded !== null) {
          values[option.id] = encoded
        }
      }
    }
    return values
  }, [snapshot])
  return { surface, snapshot, picks: held, shown }
}

/**
 * The model and effort a cloud create sends when its pill showed none yet (Create before this
 * Mac's model list came in): the saved default, else the default the Mac's listing names.
 * Sending nothing would run the sandbox account's own default, which can differ.
 */
export async function resolveComposerLaunchDefaults(
  agent: TuiAgent
): Promise<Readonly<Record<string, string>>> {
  const pick = (values: Record<string, string | undefined>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(values).flatMap(([id, value]) => {
        const encoded =
          value === undefined ? null : encodeStructuredAgentSessionOptionValue(id, value)
        return encoded === null ? [] : [[id, encoded]]
      })
    )
  const saved = structuredLaunchSeedOptions(useAppStore.getState().settings, agent)
  if (saved?.model) {
    return pick({ model: saved.model, effort: saved.effort })
  }
  const target = structuredAgentSessionTargetForHost('local')
  if (!target) {
    return {}
  }
  const answer = await Promise.race([
    callStructuredAgentSession<AgentSessionModelCatalogResult>(
      target,
      'agentSession.modelCatalog',
      {
        agent,
        waitForListing: true
      }
    ).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ])
  const listed =
    answer && 'models' in answer ? answer.models.find((model) => model.isDefault) : null
  return listed ? pick({ model: listed.id, effort: listed.defaultEffort }) : {}
}
