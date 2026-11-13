import React from 'react'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import type { RevioPromptId } from '../revio-prompts'
import { RevioSettingRow, RevioSettingsGroup } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { withRepoGeneralPreferences } from '../../../../../shared/revio-repo-prompts'

function RepoPromptEditor({
  repoId,
  id
}: {
  repoId: string
  id: RevioPromptId
}): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.revioRepoPrompts?.[repoId]?.[id] ?? ''
  const [draft, setDraft] = React.useState(saved)
  return (
    <Textarea
      value={draft}
      rows={3}
      placeholder={translate(
        'auto.components.revioLayout.settings.repoPromptPlaceholder',
        'Empty uses the prompt from Settings > Prompts.'
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() === saved.trim()) {
          return
        }
        const repoPrompts = {
          ...settings.revioRepoPrompts?.[repoId],
          [id]: draft.trim() || undefined
        }
        update({
          revioRepoPrompts: { ...settings.revioRepoPrompts, [repoId]: repoPrompts }
        })
      }}
    />
  )
}

function RepoGeneralPreferencesEditor({ repoId }: { repoId: string }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.revioRepoGeneralPreferences?.[repoId] ?? ''
  const [draft, setDraft] = React.useState(saved)
  return (
    <Textarea
      value={draft}
      rows={3}
      aria-label={translate(
        'auto.components.revioLayout.settings.generalPreferences',
        'General preferences'
      )}
      placeholder={translate(
        'auto.components.revioLayout.settings.repoGeneralPreferencesPlaceholder',
        'Empty uses General preferences from Settings > Prompts.'
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() === saved.trim()) {
          return
        }
        update({
          revioRepoGeneralPreferences: withRepoGeneralPreferences(
            settings.revioRepoGeneralPreferences,
            repoId,
            draft
          )
        })
      }}
    />
  )
}

/** The per-repository prompts for the one-click actions; blank keeps the global prompt. */
export function RevioRepoPromptsRows({ repoId }: { repoId: string }): React.JSX.Element {
  const rows: { id: RevioPromptId; label: string }[] = [
    {
      id: 'review',
      label: translate('auto.components.revioLayout.settings.promptReview', 'Review')
    },
    {
      id: 'createPr',
      label: translate('auto.components.revioLayout.settings.promptCreatePr', 'Create PR')
    },
    {
      id: 'fixErrors',
      label: translate('auto.components.revioLayout.settings.promptFix', 'Fix errors')
    },
    {
      id: 'resolveConflicts',
      label: translate('auto.components.revioLayout.settings.promptResolve', 'Resolve conflicts')
    }
  ]
  return (
    <>
      <RevioSettingsGroup
        title={translate(
          'auto.components.revioLayout.settings.repoPrompts',
          'Prompts for this repository'
        )}
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.generalPreferences',
          'General preferences'
        )}
        description={translate(
          'auto.components.revioLayout.settings.repoGeneralPreferencesDescription',
          'Add custom instructions sent to the agent at the start of every new chat. Claude chats only.'
        )}
        below={<RepoGeneralPreferencesEditor key={repoId} repoId={repoId} />}
      />
      {rows.map((row) => (
        <RevioSettingRow
          key={`${repoId}:${row.id}`}
          label={row.label}
          below={<RepoPromptEditor key={repoId} repoId={repoId} id={row.id} />}
        />
      ))}
    </>
  )
}
