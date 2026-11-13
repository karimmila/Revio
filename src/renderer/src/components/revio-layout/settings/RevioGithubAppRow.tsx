import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  githubAppOverrideProblem,
  type GithubAppOverride
} from '../../../../../shared/cloud/github-app-config'
import { RevioSettingRow } from './RevioSettingsRows'

function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

type Field = keyof GithubAppOverride

/**
 * Another GitHub App for cloud sign-in: a client ID, its URL name, and a GitHub Enterprise Server
 * host (the API base follows from it). Blank fields use the app this build ships with. Main
 * validates again; changing the app signs the person out of the old one.
 */
export function RevioGithubAppRow(): React.JSX.Element {
  const [draft, setDraft] = React.useState<GithubAppOverride>({})
  const [saved, setSaved] = React.useState<GithubAppOverride>({})
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    void window.api.cloud?.githubAppOverride().then((value) => {
      setDraft(value)
      setSaved(value)
    })
  }, [])
  const dirty = (['clientId', 'slug', 'host'] as const).some(
    (field) => (draft[field] ?? '') !== (saved[field] ?? '')
  )
  const save = (): void => {
    const problem = githubAppOverrideProblem(draft)
    if (problem) {
      setError(problem)
      return
    }
    void window.api.cloud
      ?.githubSetAppOverride(draft)
      .then((value) => {
        setError(null)
        setDraft(value)
        setSaved(value)
      })
      .catch((reason: unknown) => setError(errorText(reason)))
  }
  const field = (name: Field, label: string, placeholder: string): React.JSX.Element => (
    <Input
      value={draft[name] ?? ''}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
      aria-label={label}
      variant="code"
      className="h-8 w-56"
    />
  )
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.githubAppCustom', 'GitHub App')}
      description={translate(
        'auto.components.revioLayout.settings.githubAppCustomDescription',
        'Sign cloud workspaces in with another GitHub App, or one on GitHub Enterprise Server. Leave the fields empty to use the built-in app.'
      )}
      hint={error ? <span className="text-destructive">{error}</span> : undefined}
      below={
        <div className="flex flex-wrap items-center gap-2">
          {field(
            'clientId',
            translate('auto.components.revioLayout.settings.githubAppClientId', 'Client ID'),
            'Iv23li…'
          )}
          {field(
            'slug',
            translate('auto.components.revioLayout.settings.githubAppSlug', 'App name in URL'),
            'my-app'
          )}
          {field(
            'host',
            translate('auto.components.revioLayout.settings.githubAppHost', 'GitHub host'),
            'github.com'
          )}
          <button type="button" data-revio-settings-button="" disabled={!dirty} onClick={save}>
            {translate('auto.components.revioLayout.settings.githubSave', 'Save')}
          </button>
        </div>
      }
    />
  )
}
