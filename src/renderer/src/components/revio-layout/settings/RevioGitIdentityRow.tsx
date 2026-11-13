import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { RevioSettingRow } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** "Git identity": the name and email commits in cloud workspaces use. */
export function RevioGitIdentityRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const identity = settings.revioGitIdentity ?? {}
  const [name, setName] = React.useState(identity.name ?? '')
  const [email, setEmail] = React.useState(identity.email ?? '')
  const save = (next: { name: string; email: string }): void =>
    update({ revioGitIdentity: { name: next.name.trim(), email: next.email.trim() } })
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.gitIdentity', 'Git identity')}
      description={translate(
        'auto.components.revioLayout.settings.gitIdentityDescription',
        "Name and email used for commits in cloud workspaces. Leave blank to use this Mac's git config."
      )}
      below={
        <div className="flex gap-2">
          <Input
            value={name}
            className="h-7 flex-1"
            aria-label={translate('auto.components.revioLayout.settings.gitName', 'Name')}
            placeholder={translate('auto.components.revioLayout.settings.gitName', 'Name')}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => save({ name, email })}
          />
          <Input
            value={email}
            type="email"
            className="h-7 flex-1"
            aria-label={translate('auto.components.revioLayout.settings.gitEmail', 'Email')}
            placeholder={translate('auto.components.revioLayout.settings.gitEmail', 'Email')}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => save({ name, email })}
          />
        </div>
      }
    />
  )
}
