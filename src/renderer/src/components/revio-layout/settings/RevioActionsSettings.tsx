import React from 'react'
import { useAppStore } from '@/store'
import { Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import {
  parseImportedAction,
  stripScriptSecrets,
  type ActionRunMode,
  type RepoAction
} from '../../../../../shared/actions/repo-actions'
import { normalizePreviewUrls } from '../../../../../shared/actions/preview-urls'
import { IMPORT_SOURCE_APP } from '../../../../../shared/import-source-app'
import { isActionHidden, toggleHiddenAction } from '../../../../../shared/actions/hidden-actions'
import { RevioSelect, RevioSettingRow, RevioSettingsGroup } from './RevioSettingsRows'
import { RevioActionRow } from './RevioActionRow'
import { RevioSpotlightRow } from './RevioSpotlightRow'

function newId(): string {
  return `personal:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Actions for this repository. New ones are personal (kept on this Mac); a repository's committed
 * `.orca/actions.toml` actions are still listed and saved back as they are. The import source app keeps its actions on its own servers, so importing
 * takes a pasted script (its export carries the name and "Can run in" line); secret values become
 * `${NAME}` references to set under Environment, never literals.
 */
export function RevioActionsSettings({ repoId }: { repoId: string }): React.JSX.Element {
  const hiddenActions = useAppStore((s) => s.settings?.revioHiddenActions)
  const api = window.api.repoActions
  const [actions, setActions] = React.useState<RepoAction[] | null>(null)
  const [sharedError, setSharedError] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [pasting, setPasting] = React.useState(false)
  const [pasted, setPasted] = React.useState('')
  const [runMode, setRunMode] = React.useState<ActionRunMode>('concurrent')
  const [previewUrls, setPreviewUrls] = React.useState('')
  React.useEffect(() => {
    void api?.list(repoId).then((listed) => {
      setActions(listed.actions)
      setRunMode(listed.runMode)
      setPreviewUrls(listed.previewUrls.join('\n'))
      setSharedError(listed.sharedError)
    })
  }, [api, repoId])
  const list = actions ?? []
  const update = (next: RepoAction[]): void => {
    setActions(next)
    setDirty(true)
  }
  const importPasted = (): void => {
    const parsed = parseImportedAction(pasted)
    const safe = stripScriptSecrets(parsed.script.trim())
    update([
      ...list,
      {
        id: newId(),
        name:
          parsed.name ??
          translate('auto.components.revioLayout.settings.importedAction', 'Imported action'),
        script: safe.script,
        targets: parsed.targets.length > 0 ? parsed.targets : ['local'],
        shared: false
      }
    ])
    setPasted('')
    setPasting(false)
    if (safe.variables.length > 0) {
      toast.message(
        translate(
          'auto.components.revioLayout.settings.importedSecrets',
          'Add {{value0}} under Settings, Environment (mark them Cloud for cloud workspaces). The script reads them; it holds no secret values.',
          { value0: safe.variables.join(', ') }
        )
      )
    }
  }
  return (
    <>
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.actions', 'Actions')}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.actions', 'Actions')}
        description={
          sharedError ??
          translate(
            'auto.components.revioLayout.settings.actionsDescription',
            'Run from the Run button above the terminal (⌘R runs the last one).'
          )
        }
        control={
          <>
            <button
              type="button"
              data-revio-settings-text-button=""
              onClick={() => setPasting((open) => !open)}
            >
              <Download className="size-3.5" />
              {translate(
                'auto.components.revioLayout.settings.importFromApp',
                'Import from {{value0}}',
                {
                  value0: IMPORT_SOURCE_APP
                }
              )}
            </button>
            <button
              type="button"
              data-revio-settings-button=""
              disabled={!dirty || !api}
              onClick={() =>
                void api
                  ?.save(repoId, list, runMode, normalizePreviewUrls(previewUrls.split('\n')))
                  .then(() => {
                    setDirty(false)
                    toast.success(
                      translate(
                        'auto.components.revioLayout.settings.actionsSaved',
                        'Actions saved'
                      )
                    )
                  })
                  .catch((error: unknown) => toast.error(String(error)))
              }
            >
              {translate('auto.components.revioLayout.settings.saveActions', 'Save actions')}
            </button>
          </>
        }
        below={
          <div className="flex flex-col gap-2">
            {pasting ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={pasted}
                  rows={6}
                  variant="code"
                  spellCheck={false}
                  placeholder={translate(
                    'auto.components.revioLayout.settings.importPlaceholder',
                    'Paste one action script from {{value0}} (Configure, open the action, copy its script).',
                    { value0: IMPORT_SOURCE_APP }
                  )}
                  onChange={(event) => setPasted(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-revio-settings-button=""
                    disabled={!pasted.trim()}
                    onClick={importPasted}
                  >
                    {translate('auto.components.revioLayout.settings.importAction', 'Import')}
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
            ) : null}
            {list.map((action, index) => (
              <RevioActionRow
                key={action.id}
                action={action}
                first={index === 0}
                last={index === list.length - 1}
                onChange={(next) =>
                  update(list.map((entry) => (entry.id === action.id ? next : entry)))
                }
                onMove={(delta) => {
                  const next = [...list]
                  const [moved] = next.splice(index, 1)
                  if (moved) {
                    next.splice(index + delta, 0, moved)
                    update(next)
                  }
                }}
                onRemove={() => update(list.filter((entry) => entry.id !== action.id))}
                hidden={isActionHidden(hiddenActions, repoId, action.id)}
                onToggleHidden={() =>
                  void useAppStore.getState().updateSettings({
                    revioHiddenActions: toggleHiddenAction(hiddenActions, repoId, action.id)
                  })
                }
              />
            ))}
            <button
              type="button"
              data-revio-settings-text-button=""
              onClick={() =>
                update([
                  ...list,
                  {
                    id: newId(),
                    name: translate('auto.components.revioLayout.settings.newAction', 'New action'),
                    script: '',
                    targets: ['local'],
                    shared: false
                  }
                ])
              }
            >
              <Plus className="size-3.5" />
              {translate('auto.components.revioLayout.addAction', 'Add action')}
            </button>
          </div>
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.runMode', 'Run mode')}
        description={translate(
          'auto.components.revioLayout.settings.runModeDescription',
          'Nonconcurrent stops the runs of other workspaces of this repository when one starts. Use it when they share a port, database or Docker stack.'
        )}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.runMode', 'Run mode')}
            value={runMode}
            options={[
              {
                value: 'concurrent',
                label: translate('auto.components.revioLayout.settings.concurrent', 'Concurrent')
              },
              {
                value: 'nonconcurrent',
                label: translate(
                  'auto.components.revioLayout.settings.nonconcurrent',
                  'Nonconcurrent'
                )
              }
            ]}
            onChange={(next) => {
              setRunMode(next)
              setDirty(true)
            }}
          />
        }
      />
      <RevioSpotlightRow repoId={repoId} />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.previewUrls', 'Preview URLs')}
        description={translate(
          'auto.components.revioLayout.settings.previewUrlsDescription',
          'One per line. ⌘⇧B opens the first; the Run menu lists them all. ${{envPrefix}}_PORT is the workspace port; $(({{envPrefix}}_PORT + 1)) through $(({{envPrefix}}_PORT + 9)) reach its other ports.'
        )}
        below={
          <Textarea
            value={previewUrls}
            rows={3}
            variant="code"
            spellCheck={false}
            placeholder={translate(
              'auto.components.revioLayout.settings.previewUrlsPlaceholder',
              'http://localhost:${{envPrefix}}_PORT'
            )}
            onChange={(event) => {
              setPreviewUrls(event.target.value)
              setDirty(true)
            }}
          />
        }
      />
    </>
  )
}
