import React from 'react'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import { RevioSettingRow } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** "Environment variable files": env files loaded into this repository's scripts. */
export function RevioEnvFilesRow({ repoId }: { repoId: string }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [draft, setDraft] = React.useState((settings.revioEnvFiles?.[repoId] ?? []).join('\n'))
  const save = (): void => {
    const files = draft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
    const { [repoId]: _previous, ...rest } = settings.revioEnvFiles ?? {}
    update({ revioEnvFiles: files.length > 0 ? { ...rest, [repoId]: files } : rest })
  }
  return (
    <RevioSettingRow
      label={translate(
        'auto.components.revioLayout.settings.envFiles',
        'Environment variable files'
      )}
      description={translate(
        'auto.components.revioLayout.settings.envFilesDescription',
        'One per line, relative to the workspace. Setup, archive and Run scripts load them in order; later files win.'
      )}
      below={
        <Textarea
          value={draft}
          rows={2}
          variant="code"
          spellCheck={false}
          placeholder={translate(
            'auto.components.revioLayout.settings.envFilesPlaceholder',
            '.env.local'
          )}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
        />
      }
    />
  )
}
