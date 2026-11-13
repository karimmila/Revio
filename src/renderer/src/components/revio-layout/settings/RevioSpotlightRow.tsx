import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** "Use spotlight testing" for one repository. */
export function RevioSpotlightRow({ repoId }: { repoId: string }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const repos = settings.revioSpotlightRepos ?? []
  const label = translate('auto.components.revioLayout.settings.spotlight', 'Use spotlight testing')
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.spotlightDescription',
        "Adds Spotlight next to Run: workspace changes sync into the repository root, and actions run there. The root's own uncommitted changes are overwritten."
      )}
      control={
        <RevioSwitch
          label={label}
          checked={repos.includes(repoId)}
          onChange={(checked) =>
            update({
              revioSpotlightRepos: checked
                ? [...repos.filter((id) => id !== repoId), repoId]
                : repos.filter((id) => id !== repoId)
            })
          }
        />
      }
    />
  )
}
