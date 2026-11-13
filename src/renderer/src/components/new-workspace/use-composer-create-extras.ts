import { useCallback, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  clearSubmittedNewWorkspacePromptDraft,
  markNewWorkspacePromptDraftSubmitted,
  readNewWorkspacePromptDraft,
  useNewWorkspacePromptDraft,
  type ComposerLocation
} from '@/lib/new-workspace-prompt-draft'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import {
  agentPickerLaunchInputs,
  type AgentPickerDraft,
  type AgentPickerEntry
} from '../../../../shared/agent-launch/picker/agent-launch-picker'
import { resolveComposerLaunchDefaults, useComposerChatOptions } from './use-composer-chat-options'
import type { QuickSubmitOptions } from '@/hooks/composer-state/quick-creation-request'

type SubmitQuick = (agent: TuiAgent | null, options?: QuickSubmitOptions) => Promise<void>

function composerLocation(cloud: boolean): ComposerLocation {
  return cloud ? 'cloud' : 'mac'
}

/** The Create dialog opens with the current location's prompt draft. */
export function promptDraftNow(): string {
  return readNewWorkspacePromptDraft(
    composerLocation(useAppStore.getState().settings?.revioLocation === 'cloud')
  )
}

/** The agent menu's picks as launch inputs; a terminal pick with untouched arguments keeps the
 *  agent's saved arguments once its defaults have loaded. */
export function pickerLaunchInputs(
  draft: AgentPickerDraft | undefined,
  entry: AgentPickerEntry | undefined
): ReturnType<typeof agentPickerLaunchInputs> | undefined {
  if (!draft) {
    return undefined
  }
  if (
    draft.surface === 'terminal' &&
    draft.arguments === undefined &&
    entry &&
    !entry.defaultsPending
  ) {
    return agentPickerLaunchInputs({ ...draft, arguments: entry.arguments ?? null }, entry)
  }
  return agentPickerLaunchInputs(draft, entry)
}

/** A created workspace used its draft up; the dialog then closes as before. */
export function afterCreate(close: () => void): () => void {
  return () => {
    clearSubmittedNewWorkspacePromptDraft()
    close()
  }
}

/**
 * What the Create dialog adds around Orca's composer: the per-location prompt
 * draft, and the first chat's model and effort pill, whose picks ride on the create's launch
 * inputs for both a chat and a terminal launch. On this Mac an untouched pill sends nothing.
 */
export function useComposerCreateExtras(
  quickAgent: TuiAgent | null,
  card: Pick<NewWorkspaceComposerCardProps, 'agentPrompt' | 'onAgentPromptChange'>,
  submitQuick: SubmitQuick
): { chatOptions: ReturnType<typeof useComposerChatOptions>; submitQuick: SubmitQuick } {
  const location = composerLocation(useAppStore((s) => s.settings?.revioLocation === 'cloud'))
  useNewWorkspacePromptDraft(location, card.agentPrompt ?? '', card.onAgentPromptChange)
  const chatOptions = useComposerChatOptions(quickAgent)
  // A cloud workspace's agent has its own account default, which may differ from this Mac's
  // (Sonnet there, Opus here, 2026-11-09), so its first chat gets what the pill shows.
  const shownPicks = useMemo(
    () =>
      location === 'cloud' ? { ...chatOptions.shown, ...chatOptions.picks } : chatOptions.picks,
    [chatOptions.picks, chatOptions.shown, location]
  )
  const submit = useCallback(
    async (agent: TuiAgent | null, options?: QuickSubmitOptions) => {
      markNewWorkspacePromptDraftSubmitted(location)
      let picks = shownPicks
      if (location === 'cloud' && agent && !picks.model) {
        picks = { ...(await resolveComposerLaunchDefaults(agent)), ...picks }
      }
      if (Object.keys(picks).length === 0) {
        return submitQuick(agent, options)
      }
      const launchInputs = options?.launchInputs
      return submitQuick(agent, {
        ...options,
        launchInputs: {
          ...launchInputs,
          sessionOptions: { ...launchInputs?.sessionOptions, ...picks },
          chatSessionOptions: { ...launchInputs?.chatSessionOptions, ...picks }
        }
      })
    },
    [location, shownPicks, submitQuick]
  )
  return { chatOptions, submitQuick: submit }
}
