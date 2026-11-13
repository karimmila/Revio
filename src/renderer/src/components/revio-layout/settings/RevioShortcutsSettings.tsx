import type React from 'react'
import { translate } from '@/i18n/i18n'
import { ShortcutsPane } from '@/components/settings/shortcuts/ShortcutsPane'
import { RevioSettingsPage } from './RevioSettingsRows'

/** The Keyboard shortcuts page: Orca's recorder, so both pages edit one keybindings file. */
export function RevioShortcutsSettings(): React.JSX.Element {
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.shortcuts', 'Keyboard shortcuts')}
      description={translate(
        'auto.components.revioLayout.settings.shortcutsDescription',
        'Click a shortcut, then type the new one. Reset puts back the default.'
      )}
    >
      <ShortcutsPane />
    </RevioSettingsPage>
  )
}
