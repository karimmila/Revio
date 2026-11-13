import React from 'react'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_REVIO_PROMPTS, type RevioPromptId } from '../revio-prompts'
import { RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

function PromptEditor({ id }: { id: RevioPromptId }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.revioPrompts?.[id] ?? ''
  const [draft, setDraft] = React.useState(saved || DEFAULT_REVIO_PROMPTS[id])
  const isDefault = draft.trim() === DEFAULT_REVIO_PROMPTS[id]
  const commit = (value: string): void => {
    const trimmed = value.trim()
    // Saving the default text clears the override, so a later default change still reaches it.
    const next = trimmed === DEFAULT_REVIO_PROMPTS[id] ? undefined : trimmed || undefined
    update({ revioPrompts: { ...settings.revioPrompts, [id]: next } })
  }
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        rows={4}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
      />
      {isDefault ? null : (
        <button
          type="button"
          data-revio-settings-text-button=""
          onClick={() => {
            setDraft(DEFAULT_REVIO_PROMPTS[id])
            commit(DEFAULT_REVIO_PROMPTS[id])
          }}
        >
          {translate('auto.components.revioLayout.settings.resetPrompt', 'Reset to default')}
        </button>
      )}
    </div>
  )
}

function GeneralPreferencesEditor(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.revioGeneralPreferences ?? ''
  const [draft, setDraft] = React.useState(saved)
  return (
    <Textarea
      value={draft}
      rows={4}
      placeholder={translate(
        'auto.components.revioLayout.settings.generalPreferencesPlaceholder',
        'e.g. Prefer small commits. Ask before adding a dependency.'
      )}
      aria-label={translate(
        'auto.components.revioLayout.settings.generalPreferences',
        'General preferences'
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== saved.trim()) {
          update({ revioGeneralPreferences: draft.trim() || undefined })
        }
      }}
    />
  )
}

export function RevioPromptsSettings(): React.JSX.Element {
  const rows: { id: RevioPromptId; label: string; description: string }[] = [
    {
      id: 'review',
      label: translate('auto.components.revioLayout.settings.promptReview', 'Review'),
      description: translate(
        'auto.components.revioLayout.settings.promptReviewDescription',
        'Sent when you click Review above the changes.'
      )
    },
    {
      id: 'createPr',
      label: translate('auto.components.revioLayout.settings.promptCreatePr', 'Create PR'),
      description: translate(
        'auto.components.revioLayout.settings.promptCreatePrDescription',
        'Sent when you click Create PR.'
      )
    },
    {
      id: 'fixErrors',
      label: translate('auto.components.revioLayout.settings.promptFix', 'Fix errors'),
      description: translate(
        'auto.components.revioLayout.settings.promptFixDescription',
        'Sent when you click Fix on a pull request with failing checks.'
      )
    },
    {
      id: 'resolveConflicts',
      label: translate('auto.components.revioLayout.settings.promptResolve', 'Resolve conflicts'),
      description: translate(
        'auto.components.revioLayout.settings.promptResolveDescription',
        'Sent when you click Resolve on a pull request with merge conflicts.'
      )
    }
  ]
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.prompts', 'Prompts')}
      description={translate(
        'auto.components.revioLayout.settings.promptsDescription',
        'What the one-click actions ask the agent to do.'
      )}
    >
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.generalPreferences',
          'General preferences'
        )}
        description={translate(
          'auto.components.revioLayout.settings.generalPreferencesDescription',
          'Add custom instructions sent to the agent at the start of every new chat.'
        )}
        below={<GeneralPreferencesEditor />}
      />
      {rows.map((row) => (
        <RevioSettingRow
          key={row.id}
          label={row.label}
          description={row.description}
          below={<PromptEditor id={row.id} />}
        />
      ))}
    </RevioSettingsPage>
  )
}
