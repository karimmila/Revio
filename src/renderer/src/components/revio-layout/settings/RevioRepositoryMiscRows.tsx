import React from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import { McpConfigSection } from '@/components/settings/repository/mcp/McpConfigSection'
import { RepositoryIconPicker } from '@/components/settings/repository/identity/RepositoryIconPicker'
import { getDefaultRepoHookSettings } from '../../../../../shared/constants'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import { resolveConfiguredWorktreeBasePaths } from '../../../../../shared/worktree/configured-worktree-base-path'
import type { Repo } from '../../../../../shared/repo-types'
import { RevioSettingRow, RevioSettingsGroup } from './RevioSettingsRows'
import { RevioFilesToCopyRow } from './RevioFilesToCopyRow'
import { RevioAgentSettingsTrustRow } from './RevioAgentSettingsTrustRow'

function ArchiveScriptEditor({ repo }: { repo: Repo }): React.JSX.Element {
  const updateRepo = useAppStore((s) => s.updateRepo)
  const hooks = repo.hookSettings ?? getDefaultRepoHookSettings()
  const [draft, setDraft] = React.useState(hooks.scripts.archive)
  const save = async (): Promise<void> => {
    const saved = await updateRepo(repo.id, {
      hookSettings: { ...hooks, scripts: { ...hooks.scripts, archive: draft } }
    })
    if (saved) {
      toast.success(
        translate('auto.components.revioLayout.settings.archiveSaved', 'Archive script saved')
      )
    }
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <Textarea
        value={draft}
        rows={6}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        variant="code"
      />
      <button
        type="button"
        data-revio-settings-button=""
        disabled={draft === hooks.scripts.archive}
        onClick={() => void save()}
      >
        {translate('auto.components.revioLayout.settings.saveArchive', 'Save archive script')}
      </button>
    </div>
  )
}

function PathText({ path }: { path: string }): React.JSX.Element {
  return <code data-revio-settings-path="">{path}</code>
}

/** The repository rows after the scripts: archive script, then Misc. */
export function RevioRepositoryMiscRows({ repo }: { repo: Repo }): React.JSX.Element {
  const updateRepo = useAppStore((s) => s.updateRepo)
  const workspaceDir = useAppStore((s) => s.settings?.workspaceDir ?? '')
  const openModal = useAppStore((s) => s.openModal)
  const workspacesPath = resolveConfiguredWorktreeBasePaths(repo)[0] ?? workspaceDir
  return (
    <>
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.archiveScript', 'Archive script')}
        description={translate(
          'auto.components.revioLayout.settings.archiveScriptDescription',
          'Runs before a workspace is archived. Saved on this Mac only.'
        )}
        below={<ArchiveScriptEditor key={repo.id} repo={repo} />}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.mcpServers', 'MCP servers')}
        description={translate(
          'auto.components.revioLayout.settings.mcpServersDescription',
          "The MCP config files agents read in this repository's workspaces."
        )}
        below={<McpConfigSection repo={repo} />}
      />
      <RevioAgentSettingsTrustRow repo={repo} />
      <RevioSettingsGroup title={translate('auto.components.revioLayout.settings.misc', 'Misc')} />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.icon', 'Icon')}
        description={translate(
          'auto.components.revioLayout.settings.iconDescription',
          'Shown next to the repository name in the sidebar.'
        )}
        below={
          <RepositoryIconPicker
            repo={repo}
            updateRepo={(repoId, updates) => void updateRepo(repoId, updates)}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.rootPath', 'Root path')}
        description={translate(
          'auto.components.revioLayout.settings.rootPathDescription',
          'Do not move or delete this directory. Instead, remove the repository here.'
        )}
        hint={<PathText path={repo.path} />}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.workspacesPath', 'Workspaces path')}
        description={translate(
          'auto.components.revioLayout.settings.workspacesPathDescription',
          'Do not move or delete the workspace subdirectories. Instead, archive workspaces.'
        )}
        hint={<PathText path={workspacesPath} />}
      />
      <RevioFilesToCopyRow repo={repo} />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.removeRepository',
          'Remove repository'
        )}
        description={translate(
          'auto.components.revioLayout.settings.removeRepositoryDescription',
          'Remove this repository and its workspaces from {{productName}}.'
        )}
        control={
          <button
            type="button"
            data-revio-settings-button=""
            data-variant="destructive"
            onClick={() =>
              openModal('confirm-remove-folder', {
                repoId: repo.id,
                displayName: repo.displayName,
                hostId: getRepoExecutionHostId(repo)
              })
            }
          >
            {translate('auto.components.revioLayout.settings.remove', 'Remove')}
          </button>
        }
      />
    </>
  )
}
