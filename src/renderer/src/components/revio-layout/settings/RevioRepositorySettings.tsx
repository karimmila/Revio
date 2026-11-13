import React from 'react'
import { RevioRemoteControl } from './RevioRemoteControl'
import { RevioEnvFilesRow } from './RevioEnvFilesRow'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getDefaultRepoHookSettings } from '../../../../../shared/constants'
import type { Repo } from '../../../../../shared/repo-types'
import { RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { RevioCloudRepoSettings } from './RevioCloudRepoSettings'
import { RevioActionsSettings } from './RevioActionsSettings'
import { RevioRepositoryMiscRows } from './RevioRepositoryMiscRows'
import { RevioRepoPromptsRows } from './RevioRepoPromptsRows'
import { openRevioSettingsPage } from './revio-settings-view'

function BaseBranchControl({ repo }: { repo: Repo }): React.JSX.Element {
  const updateRepo = useAppStore((s) => s.updateRepo)
  const [draft, setDraft] = React.useState(repo.worktreeBaseRef ?? '')
  const commit = (): void => {
    const next = draft.trim()
    if (next === (repo.worktreeBaseRef ?? '')) {
      return
    }
    void updateRepo(repo.id, { worktreeBaseRef: next || undefined })
  }
  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
      placeholder={translate(
        'auto.components.revioLayout.settings.baseBranchPlaceholder',
        "The repository's default branch"
      )}
      aria-label={translate('auto.components.revioLayout.settings.baseBranch', 'Default branch')}
      variant="code"
      className="h-8 w-64"
    />
  )
}

function SetupScriptEditor({ repo }: { repo: Repo }): React.JSX.Element {
  const updateRepo = useAppStore((s) => s.updateRepo)
  const hooks = repo.hookSettings ?? getDefaultRepoHookSettings()
  const [draft, setDraft] = React.useState(hooks.scripts.setup)
  const dirty = draft !== hooks.scripts.setup
  const save = async (): Promise<void> => {
    const saved = await updateRepo(repo.id, {
      hookSettings: {
        ...hooks,
        // The workspace layout runs the setup script on every new workspace without asking.
        ...(draft.trim() ? { setupRunPolicy: 'run-by-default' as const } : {}),
        scripts: { ...hooks.scripts, setup: draft }
      }
    })
    if (saved) {
      toast.success(
        translate('auto.components.revioLayout.settings.setupSaved', 'Setup script saved')
      )
    }
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <Textarea
        value={draft}
        rows={10}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        variant="code"
      />
      <button
        type="button"
        data-revio-settings-button=""
        disabled={!dirty}
        onClick={() => void save()}
      >
        {translate('auto.components.revioLayout.settings.saveSetup', 'Save setup script')}
      </button>
    </div>
  )
}

export function RevioRepositorySettings({ repoId }: { repoId: string }): React.JSX.Element {
  const repo = useAppStore((s) => s.repos.find((candidate) => candidate.id === repoId))
  // Remove takes the repository away under this page; General replaces the then-empty page.
  const seen = React.useRef(false)
  React.useEffect(() => {
    if (repo) {
      seen.current = true
    } else if (seen.current) {
      openRevioSettingsPage('general')
    }
  }, [repo])
  if (!repo) {
    return (
      <RevioSettingsPage
        title={translate('auto.components.revioLayout.settings.repository', 'Repository')}
      >
        {null}
      </RevioSettingsPage>
    )
  }
  return (
    <RevioSettingsPage title={repo.displayName} description={repo.path}>
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.baseBranch', 'Default branch')}
        description={translate(
          'auto.components.revioLayout.settings.baseBranchDescription',
          'New workspaces branch from the latest version of this branch.'
        )}
        control={<BaseBranchControl key={repo.id} repo={repo} />}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.repoRemote', 'Remote')}
        description={translate(
          'auto.components.revioLayout.settings.repoRemoteDescription',
          'Where to push, pull and look up pull requests. Automatic picks origin or upstream for each action.'
        )}
        control={<RevioRemoteControl repoId={repo.id} />}
      />
      <RevioEnvFilesRow key={`env-files-${repo.id}`} repoId={repo.id} />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.setupScript', 'Setup script')}
        description={translate(
          'auto.components.revioLayout.settings.setupScriptDescription',
          'Runs when a new workspace is created. Saved on this Mac only.'
        )}
        below={<SetupScriptEditor key={repo.id} repo={repo} />}
      />
      {window.api.repoActions ? (
        <RevioActionsSettings key={`actions-${repo.id}`} repoId={repo.id} />
      ) : null}
      {window.api.cloud ? <RevioCloudRepoSettings key={repo.id} repoId={repo.id} /> : null}
      <RevioRepoPromptsRows repoId={repo.id} />
      <RevioRepositoryMiscRows repo={repo} />
    </RevioSettingsPage>
  )
}
