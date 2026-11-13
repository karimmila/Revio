import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { composerSurfaceFor } from '@/components/native-chat/native-chat-composer-surface-registry'
import { isTuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import { loadoutFitsChat, type RevioLoadout } from '../../../../../shared/revio-loadouts'
import { launchRevioAgentChat } from '../launch-revio-chat'

function modelChoices(composer: HTMLElement | null): readonly string[] | null {
  const descriptor = composer
    ? composerSurfaceFor(composer)
        ?.snapshot()
        .find((entry) => entry.category === 'model')
    : undefined
  return descriptor?.kind.type === 'select'
    ? descriptor.kind.choices.map((choice) => choice.value)
    : null
}

/** Puts the loadout on the chat on screen, or opens a new chat with its agent and model. */
export async function applyRevioLoadout(
  loadout: RevioLoadout,
  composer: HTMLElement | null
): Promise<void> {
  const registered = composer ? composerSurfaceFor(composer) : null
  if (registered && loadoutFitsChat(loadout, modelChoices(composer))) {
    await registered.surface.setOption('model', loadout.model)
    if (loadout.effort) {
      // Effort levels belong to a model, so the effort follows the model's change.
      await registered.surface.setOption('effort', loadout.effort)
    }
    return
  }
  const worktreeId = useAppStore.getState().activeWorktreeId
  if (!worktreeId || !isTuiAgent(loadout.agent)) {
    toast.error(
      translate('auto.components.revioLayout.loadouts.cannotApply', 'Could not use this loadout.')
    )
    return
  }
  launchRevioAgentChat(worktreeId, { agent: loadout.agent, model: loadout.model })
}

function shownComposer(): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>('[data-native-chat-composer-scope]')].find(
      (element) => element.getBoundingClientRect().width > 0
    ) ?? null
  )
}

export function applyRevioLoadoutToShownChat(loadout: RevioLoadout): Promise<void> {
  return applyRevioLoadout(loadout, shownComposer())
}

/** ⌘⌃1…5 picks that loadout. */
export function revioLoadoutSlot(event: KeyboardEvent): number | null {
  if (!event.metaKey || !event.ctrlKey || event.altKey || event.shiftKey) {
    return null
  }
  const match = /^Digit([1-5])$/.exec(event.code)
  return match ? Number(match[1]) : null
}
