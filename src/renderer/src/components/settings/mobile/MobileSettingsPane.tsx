import { SearchableSetting } from '../section-layout/SearchableSetting'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { MobilePane } from './MobilePane'
import {
  getMobileOverviewSearchEntry,
  getMobileSidebarShortcutSearchEntry
} from './mobile-settings-search'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { MobileRelayBetaNotice } from './pairing/MobileRelayBetaNotice'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'

import { androidDownloadUrl, IOS_APP_STORE_URL } from '@/components/mobile/mobile-platform-copy'

export function MobileSettingsPane(): React.JSX.Element {
  const showMobileButton = useAppStore((s) => s.settings?.showMobileButton !== false)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const androidApkUrl = androidDownloadUrl()

  return (
    <div className="space-y-4">
      <SearchableSetting
        title={translate('auto.components.settings.MobileSettingsPane.e7a3ae8c4e', 'Mobile')}
        description={translate(
          'auto.components.settings.MobileSettingsPane.174f4a3c6d',
          'Control terminals and agents from your phone.'
        )}
        keywords={getMobileOverviewSearchEntry().keywords}
        className="space-y-3 py-2"
      >
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            {translate(
              'auto.components.settings.MobileSettingsPane.installIntro',
              'Install {{productName}} Mobile from the'
            )}{' '}
            <button
              type="button"
              onClick={(event) => openAppHttpLink(IOS_APP_STORE_URL, { event })}
              className="cursor-pointer underline underline-offset-2 hover:text-foreground"
            >
              {translate('auto.components.settings.MobileSettingsPane.b5a2ed83ff', 'App Store')}
            </button>
            {androidApkUrl ? (
              <>
                {' · '}
                <button
                  type="button"
                  // Link the pinned release APK until Android distribution moves to Google Play.
                  onClick={(event) => openAppHttpLink(androidApkUrl, { event })}
                  className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                >
                  {translate(
                    'auto.components.settings.MobileSettingsPane.androidApkLabel',
                    'Android APK'
                  )}
                </button>
              </>
            ) : null}
            {translate(
              'auto.components.settings.MobileSettingsPane.installOutro',
              ', then pair below.'
            )}
          </p>
          <MobileRelayBetaNotice />
        </div>
      </SearchableSetting>

      <SearchableSetting
        title={translate(
          'auto.components.settings.MobileSettingsPane.1de96ec8a6',
          'Show {{productName}} Mobile Button'
        )}
        description={translate(
          'auto.components.settings.MobileSettingsPane.682293cadf',
          'Show the {{productName}} Mobile button at the top of the left sidebar.'
        )}
        keywords={getMobileSidebarShortcutSearchEntry().keywords}
      >
        {/* Why: the in-page removal toast points users to Settings > Mobile. */}
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.MobileSettingsPane.1de96ec8a6',
            'Show {{productName}} Mobile Button'
          )}
          description={translate(
            'auto.components.settings.MobileSettingsPane.d4f2b65f30',
            'Show the {{productName}} Mobile shortcut in the sidebar.'
          )}
          checked={showMobileButton}
          onChange={() => updateSettings({ showMobileButton: !showMobileButton })}
        />
      </SearchableSetting>

      <div className="rounded-xl border border-border/60 bg-card/50 p-4">
        <MobilePane />
      </div>
    </div>
  )
}
