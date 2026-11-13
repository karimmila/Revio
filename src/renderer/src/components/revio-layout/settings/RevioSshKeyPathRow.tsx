import React from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RevioSettingRow } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** "SSH private key path": the person's own key for new cloud workspaces. */
export function RevioSshKeyPathRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.revioCloudSshKeyPath ?? ''
  const [draft, setDraft] = React.useState(saved)
  const label = translate('auto.components.revioLayout.settings.sshKeyPath', 'SSH private key path')
  const commit = (value: string): void => {
    if (value.trim() !== saved) {
      update({ revioCloudSshKeyPath: value.trim() || undefined })
    }
  }
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.sshKeyPathDescription',
        'Use your own SSH key for cloud workspace access. Leave empty to auto-generate a key.'
      )}
      control={
        <div className="flex items-center gap-2">
          <Input
            key={saved}
            value={draft}
            placeholder={translate(
              'auto.components.revioLayout.settings.sshKeyPathPlaceholder',
              '~/.ssh/id_ed25519'
            )}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(draft)
              }
            }}
            aria-label={label}
            variant="code"
            className="h-8 w-56"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={translate(
              'auto.components.revioLayout.settings.browseSshKey',
              'Browse for SSH key'
            )}
            onClick={() =>
              void window.api.shell.pickAttachment().then((path) => {
                if (path) {
                  setDraft(path)
                  commit(path)
                }
              })
            }
          >
            {translate('auto.components.revioLayout.settings.browse', 'Browse')}
          </Button>
        </div>
      }
    />
  )
}
