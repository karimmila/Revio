import type React from 'react'
import { translate } from '@/i18n/i18n'
import { MobilePane } from '@/components/settings/mobile/MobilePane'
import { RevioSettingsPage } from './RevioSettingsRows'

/** The Remote control page; Orca's phone app stands in for the iPhone app. */
export function RevioRemoteControlSettings(): React.JSX.Element {
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.remoteControl', 'Remote control')}
      description={translate(
        'auto.components.revioLayout.settings.remoteControlDescription',
        'Pair the {{productName}} mobile app to watch and steer this Mac’s workspaces from your phone.'
      )}
    >
      <MobilePane />
    </RevioSettingsPage>
  )
}
