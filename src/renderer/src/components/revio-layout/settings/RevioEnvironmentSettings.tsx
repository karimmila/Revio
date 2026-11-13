import React from 'react'
import { FileText, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import { isGitRepoKind } from '../../../../../shared/repo-kind'
import {
  parseDotenv,
  type WorkspaceVariablesScope
} from '../../../../../shared/workspace-variables/dotenv'
import { RevioSelect, RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { RevioVariableRow } from './RevioVariableRow'
import { RevioEnvScan } from './RevioEnvScan'
import { mergeVariables, useWorkspaceVariables } from './use-workspace-variables'

function useScopeOptions(): { value: string; label: string; scope: WorkspaceVariablesScope }[] {
  const repos = useAppStore((s) => s.repos)
  return React.useMemo(
    () => [
      {
        value: 'global',
        label: translate('auto.components.revioLayout.settings.envAllRepos', 'All repositories'),
        scope: { kind: 'global' as const }
      },
      ...repos
        .filter((repo) => isGitRepoKind(repo))
        .map((repo) => ({
          value: `repo:${repo.id}`,
          label: repo.displayName,
          scope: { kind: 'repo' as const, repoId: repo.id }
        }))
    ],
    [repos]
  )
}

/**
 * The Environment page over Orca's workspace variables: one list per scope, kept as a .env
 * file in Orca's data folder and added to every terminal, chat and script Orca starts. Nothing is
 * copied into worktrees; "Cloud" marks the few a cloud workspace may receive.
 */
export function RevioEnvironmentSettings(): React.JSX.Element {
  const options = useScopeOptions()
  const [selected, setSelected] = React.useState('global')
  const option = options.find((candidate) => candidate.value === selected) ?? options[0]
  const scope: WorkspaceVariablesScope = option?.scope ?? { kind: 'global' }
  const { variables, save } = useWorkspaceVariables(scope)
  const [pasting, setPasting] = React.useState(false)
  const [pasted, setPasted] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)
  const list = variables ?? []
  const add = (incoming: Record<string, string>): void => {
    const count = Object.keys(incoming).length
    if (count > 0) {
      save(mergeVariables(list, incoming))
      toast.success(
        translate('auto.components.revioLayout.settings.envAdded', 'Added {{count}} variables', {
          count,
          defaultValue_one: 'Added {{count}} variable'
        })
      )
    }
  }
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.environment', 'Environment')}
      description={translate(
        'auto.components.revioLayout.settings.envLede',
        'Variables for every terminal, chat and script {{productName}} starts. Kept on this Mac, outside your repositories; a repository list overrides "All repositories".'
      )}
    >
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.envScope', 'Applies to')}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.envScope', 'Applies to')}
            value={option?.value ?? 'global'}
            options={options.map(({ value, label }) => ({ value, label }))}
            onChange={setSelected}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.envList', 'Variables')}
        description={translate(
          'auto.components.revioLayout.settings.envCloudHint',
          'The cloud mark sends a variable to cloud workspaces, where only setup, wake and Run scripts see it; the terminal mark also lets every sandbox shell and agent see it. Everything else stays on this Mac.'
        )}
        control={
          <>
            <button
              type="button"
              data-revio-settings-text-button=""
              onClick={() => void window.api.workspaceVariables?.openFile(scope)}
            >
              <FileText className="size-3.5" />
              {translate('auto.components.revioLayout.settings.envOpenFile', 'Open file')}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void file?.text().then((text) => add(parseDotenv(text)))
              }}
            />
            <button
              type="button"
              data-revio-settings-button=""
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {translate('auto.components.revioLayout.settings.importEnv', 'Import .env')}
            </button>
          </>
        }
        below={
          <div className="flex flex-col gap-1.5">
            {list.map((variable, index) => (
              <RevioVariableRow
                key={variable.key}
                variable={variable}
                onChange={(next) =>
                  save(list.map((candidate, at) => (at === index ? next : candidate)))
                }
                onRemove={() => save(list.filter((_, at) => at !== index))}
              />
            ))}
            {pasting ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  autoFocus
                  value={pasted}
                  rows={5}
                  variant="code"
                  spellCheck={false}
                  placeholder={translate(
                    'auto.components.revioLayout.settings.envPastePlaceholder',
                    'KEY=value, one per line'
                  )}
                  onChange={(event) => setPasted(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-revio-settings-button=""
                    onClick={() => {
                      add(parseDotenv(pasted))
                      setPasted('')
                      setPasting(false)
                    }}
                  >
                    {translate('auto.components.revioLayout.settings.envAddPasted', 'Add')}
                  </button>
                  <button
                    type="button"
                    data-revio-settings-text-button=""
                    onClick={() => setPasting(false)}
                  >
                    {translate('auto.components.revioLayout.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-revio-settings-text-button=""
                onClick={() => setPasting(true)}
              >
                <Plus className="size-3.5" />
                {translate('auto.components.revioLayout.settings.envAdd', 'Add variables')}
              </button>
            )}
          </div>
        }
      />
      {scope.kind === 'repo' ? (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.envTidy', 'Workspace .env files')}
          description={translate(
            'auto.components.revioLayout.settings.envTidyDescription',
            'Find values your workspaces hold in .env files. Add the ones that should be the same everywhere; keys that differ between services stay in their files.'
          )}
          below={
            <RevioEnvScan
              repoId={scope.repoId}
              existingKeys={new Set(list.map((variable) => variable.key))}
              onAdd={add}
            />
          }
        />
      ) : null}
    </RevioSettingsPage>
  )
}
