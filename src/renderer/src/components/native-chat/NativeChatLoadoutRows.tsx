import type React from 'react'
import { Link2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { isMacPlatform } from './native-chat-shortcut'
import { addLoadout, removeLoadout, type RevioLoadout } from '../../../../shared/revio-loadouts'
import { buildLoadoutLink } from '../../../../shared/revio-link'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'

const NONE: readonly RevioLoadout[] = []

function shortcut(slot: number): string {
  return isMacPlatform() ? `⌘⌃${slot}` : `Ctrl+Meta+${slot}`
}

/** The loadouts in the model picker: pick one (⌘⌃1…5), save the chat's current set, or
 * remove one. */
export function NativeChatLoadoutRows({
  current,
  onPicked
}: {
  /** The chat's agent, model and effort now, which "Save as loadout" keeps. */
  current: Omit<RevioLoadout, 'id'> | null
  onPicked: () => void
}): React.JSX.Element | null {
  const loadouts = useAppStore((s) => s.settings?.revioLoadouts ?? NONE)
  const revioLayout = useAppStore((s) => s.settings?.revioLayout === true)
  if (!revioLayout) {
    return null
  }
  const save = (): void => {
    if (!current) {
      return
    }
    const next = addLoadout(loadouts, { ...current, id: createBrowserUuid() })
    if (next === 'full') {
      toast.error(
        translate(
          'components.native-chat.loadouts.full',
          'You have five loadouts. Remove one to save another.'
        )
      )
      return
    }
    if (next !== 'exists') {
      void useAppStore.getState().updateSettings({ revioLoadouts: next })
    }
  }
  return (
    <div data-native-chat-loadouts className="flex flex-col border-t border-border p-1">
      <div className="px-2 py-1 text-xs text-muted-foreground">
        {translate('components.native-chat.loadouts.title', 'Loadouts')}
      </div>
      {loadouts.map((loadout, index) => (
        <div key={loadout.id} className="group flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="min-w-0 flex-1 justify-start"
            onClick={() => {
              onPicked()
              void import('@/components/revio-layout/loadouts/apply-revio-loadout').then((module) =>
                module.applyRevioLoadoutToShownChat(loadout)
              )
            }}
          >
            <span className="min-w-0 flex-1 truncate text-left">{loadout.label}</span>
            <span className="text-xs text-muted-foreground">{shortcut(index + 1)}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('components.native-chat.loadouts.copyLink', 'Copy loadout link')}
            onClick={() => {
              window.api.ui.writeClipboardText(buildLoadoutLink(loadout))
              toast.success(translate('auto.components.revioLayout.linkCopied', 'Link copied'))
            }}
          >
            <Link2 className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('components.native-chat.loadouts.remove', 'Remove loadout')}
            onClick={() =>
              void useAppStore
                .getState()
                .updateSettings({ revioLoadouts: removeLoadout(loadouts, loadout.id) })
            }
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-full justify-start"
        disabled={!current}
        onClick={save}
      >
        <Plus className="size-3" />
        {translate('components.native-chat.loadouts.save', 'Save as loadout')}
      </Button>
    </div>
  )
}
