import React from 'react'
import { translate } from '@/i18n/i18n'
import type {
  WorktreeEnvKeyReport,
  WorktreeEnvScanResult
} from '../../../../../shared/workspace-variables/worktree-env-scan'

function masked(value: string): string {
  return value.length <= 4 ? '••••' : `${value.slice(0, 2)}••••${value.slice(-2)}`
}

/**
 * Reads the repository's worktree .env files and shows which keys agree everywhere (one click adds
 * them here, so new worktrees need no copy) and which differ, which stay in their files. Nothing in
 * the worktrees changes.
 */
export function RevioEnvScan({
  repoId,
  existingKeys,
  onAdd
}: {
  repoId: string
  existingKeys: ReadonlySet<string>
  onAdd: (values: Record<string, string>) => void
}): React.JSX.Element {
  const [result, setResult] = React.useState<WorktreeEnvScanResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const scan = (): void => {
    setBusy(true)
    void window.api.workspaceVariables
      ?.scanWorktrees(repoId)
      .then(setResult)
      .finally(() => setBusy(false))
  }
  const fresh = (report: WorktreeEnvKeyReport): boolean => !existingKeys.has(report.key)
  const agreeing =
    result?.keys.filter((report) => report.values.length === 1 && fresh(report)) ?? []
  const differing = result?.keys.filter((report) => report.values.length > 1 && fresh(report)) ?? []
  return (
    <div data-revio-env-scan="">
      <div className="flex items-center gap-3">
        <button type="button" data-revio-settings-button="" disabled={busy} onClick={scan}>
          {busy
            ? translate('auto.components.revioLayout.settings.envScanning', 'Scanning…')
            : translate('auto.components.revioLayout.settings.envScan', 'Scan workspaces')}
        </button>
        {result ? (
          <span data-revio-settings-status="">
            {translate(
              'auto.components.revioLayout.settings.envScanFound',
              '{{files}} in {{folders}}',
              {
                files: translate(
                  'auto.components.revioLayout.settings.envScanFiles',
                  '{{count}} .env files',
                  { count: result.files, defaultValue_one: '{{count}} .env file' }
                ),
                folders: translate(
                  'auto.components.revioLayout.settings.envScanFolders',
                  '{{count}} folders',
                  { count: result.folders, defaultValue_one: '{{count}} folder' }
                )
              }
            )}
          </span>
        ) : null}
      </div>
      {agreeing.length > 0 ? (
        <div data-revio-env-scan-group="">
          <div className="flex items-center justify-between gap-3">
            <span>
              {translate(
                'auto.components.revioLayout.settings.envAgree',
                'Same value everywhere ({{value0}})',
                { value0: agreeing.length }
              )}
            </span>
            <button
              type="button"
              data-revio-settings-button=""
              onClick={() =>
                onAdd(
                  Object.fromEntries(
                    agreeing.map((report) => [report.key, report.values[0]?.value ?? ''])
                  )
                )
              }
            >
              {translate('auto.components.revioLayout.settings.envAddAll', 'Add all')}
            </button>
          </div>
          {agreeing.map((report) => (
            <div key={report.key} data-revio-env-scan-row="">
              <code>{report.key}</code>
              <span data-revio-settings-status="">{masked(report.values[0]?.value ?? '')}</span>
            </div>
          ))}
        </div>
      ) : null}
      {differing.length > 0 ? (
        <div data-revio-env-scan-group="">
          <span>
            {translate(
              'auto.components.revioLayout.settings.envDiffer',
              'Different values ({{value0}}): pick one to use everywhere, or leave it in the files',
              { value0: differing.length }
            )}
          </span>
          {differing.map((report) => (
            <div key={report.key} data-revio-env-scan-row="">
              <code>{report.key}</code>
              <div className="flex flex-wrap gap-1.5">
                {report.values.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    data-revio-settings-button=""
                    title={entry.locations.join('\n')}
                    onClick={() => onAdd({ [report.key]: entry.value })}
                  >
                    {masked(entry.value)} · {entry.locations.length}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
