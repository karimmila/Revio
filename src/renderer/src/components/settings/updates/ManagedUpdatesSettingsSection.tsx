import type React from 'react'
import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { releaseNoticeRepo } from '../../../../../shared/release-notice'
import { SettingsSubsectionHeader } from '../form-controls/SettingsFormControls'
import { SearchableSetting } from '../section-layout/SearchableSetting'

/**
 * Shown when the build has no update feed. With a releasesRepo the app still looks for new
 * versions and points at their download page; without one, whoever ships the build sends them.
 */
export function ManagedUpdatesSettingsSection(): React.JSX.Element {
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.updater.getVersion().then((version) => {
      if (!cancelled) {
        setAppVersion(version)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const checksReleases = releaseNoticeRepo() !== null
  const title = checksReleases
    ? translate(
        'auto.components.settings.ManagedUpdatesSettingsSection.checksTitle',
        '{{productName}} checks for new versions'
      )
    : translate(
        'auto.components.settings.ManagedUpdatesSettingsSection.title',
        'Updates are managed by your team'
      )
  const description = checksReleases
    ? translate(
        'auto.components.settings.ManagedUpdatesSettingsSection.checksDescription',
        '{{productName}} looks once a day and tells you when a new version is out. Download it from the releases page; {{productName}} does not install updates itself.'
      )
    : translate(
        'auto.components.settings.ManagedUpdatesSettingsSection.description',
        'This app does not check for or install updates. Your team sends new versions.'
      )

  return (
    <section key="updates" className="space-y-4">
      <SettingsSubsectionHeader
        title={translate(
          'auto.components.settings.GeneralUpdateSettingsSection.f2b1ccc12a',
          'Updates'
        )}
        description={translate(
          'auto.components.settings.GeneralUpdateSettingsSection.d91ebfb87e',
          'Current version: {{value0}}',
          { value0: appVersion ?? '...' }
        )}
      />
      <SearchableSetting
        title={title}
        description={description}
        keywords={['update', 'version', 'release notes', 'download']}
        className="space-y-1"
      >
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {checksReleases ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void window.api.releaseNotice?.check()}
            >
              {translate(
                'auto.components.settings.ManagedUpdatesSettingsSection.checkNow',
                'Check now'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void window.api.releaseNotice?.openReleases()}
            >
              {translate(
                'auto.components.settings.ManagedUpdatesSettingsSection.openReleases',
                'Open releases page'
              )}
            </Button>
          </div>
        ) : null}
      </SearchableSetting>
    </section>
  )
}
