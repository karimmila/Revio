import React from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { KEYBINDING_DEFINITIONS } from '../../../../shared/keybindings/definitions'
import { getEffectiveKeybindingsForAction } from '../../../../shared/keybindings/effective'
import { formatKeybindingList } from '../../../../shared/keybindings/formatting'
import {
  localizedKeybindingGroup,
  localizedKeybindingTitle
} from '@/components/settings/shortcuts/keybinding-title-copy'
import { openRevioSettingsPage } from './settings/revio-settings-view'
import { filterShortcutRows, type ShortcutRow } from './revio-shortcut-rows'

export const REVIO_SHORTCUTS_OVERLAY_EVENT = 'orca:revio-shortcuts-overlay'

const platform: NodeJS.Platform = navigator.userAgent.includes('Mac')
  ? 'darwin'
  : navigator.userAgent.includes('Windows')
    ? 'win32'
    : 'linux'

/** ⌘⌥/ "Keyboard shortcuts": a searchable list of every bound action. */
export function RevioShortcutsOverlay(): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const overrides = useAppStore((s) => s.keybindings)
  React.useEffect(() => {
    const show = (): void => {
      setQuery('')
      setOpen(true)
    }
    window.addEventListener(REVIO_SHORTCUTS_OVERLAY_EVENT, show)
    return () => window.removeEventListener(REVIO_SHORTCUTS_OVERLAY_EVENT, show)
  }, [])
  const rows: ShortcutRow[] = open
    ? KEYBINDING_DEFINITIONS.map((definition) => {
        const bindings = getEffectiveKeybindingsForAction(definition.id, platform, overrides)
        return {
          id: definition.id,
          title: localizedKeybindingTitle(definition),
          group: localizedKeybindingGroup(definition.group),
          keys: bindings.length > 0 ? formatKeybindingList(bindings, platform) : ''
        }
      })
    : []
  const shown = filterShortcutRows(rows, query)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-revio-shortcuts-overlay=""
        className="flex max-h-[70vh] flex-col sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogTitle>
          {translate('auto.components.revioLayout.settings.shortcuts', 'Keyboard shortcuts')}
        </DialogTitle>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate('auto.components.revioLayout.shortcutsSearch', 'Search shortcuts')}
          className="h-8"
        />
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
          {shown.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="min-w-0 truncate">
                {row.title}
                <span className="ml-2 text-xs text-muted-foreground">{row.group}</span>
              </span>
              <kbd className="shrink-0 font-mono text-xs text-muted-foreground">{row.keys}</kbd>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="self-end text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setOpen(false)
            useAppStore.getState().openSettingsPage()
            openRevioSettingsPage('shortcuts')
          }}
        >
          {translate('auto.components.revioLayout.editShortcuts', 'Edit shortcuts…')}
        </button>
      </DialogContent>
    </Dialog>
  )
}
