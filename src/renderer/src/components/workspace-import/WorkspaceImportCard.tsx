import React from 'react'
import { translate } from '@/i18n/i18n'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { IMPORT_SOURCE_APP } from '../../../../shared/import-source-app'
import type { WorkspaceImportSummary } from '../../../../shared/workspace-import-types'
import { pendingCounts, useWorkspaceImport } from './use-workspace-import'
import { WorkspaceImportDone } from './WorkspaceImportDone'
import { approveRepositoryScripts } from './repository-scripts-approval'

function SummaryList({ summary }: { summary: WorkspaceImportSummary }): React.JSX.Element {
  const counts = pendingCounts(summary)
  const repos = summary.repoNames.join(', ')
  const withChanges = summary.hasMirroredChanges
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      <li>
        {withChanges
          ? translate(
              'components.workspaceImport.workspacesWithKeptChanges',
              '{{value0}} workspaces ({{repos}}), with the uncommitted changes {{app}} keeps on this Mac',
              {
                value0: counts.workspaces,
                repos,
                app: IMPORT_SOURCE_APP
              }
            )
          : translate(
              'components.workspaceImport.workspaces',
              '{{value0}} workspaces ({{repos}})',
              {
                value0: counts.workspaces,
                repos
              }
            )}
      </li>
      <li>
        {translate('components.workspaceImport.chats', '{{value0}} chats', {
          value0: counts.chats
        })}
      </li>
      <li>
        {translate(
          'components.workspaceImport.scriptsIfPresent',
          'Actions and setup scripts, if your repositories have them'
        )}
      </li>
    </ul>
  )
}

/**
 * One summary of what another app's active work brings over, with a single Import. Used as the
 * first-run step and in Settings. `onClose` is the "Not now" choice, absent where there is nothing
 * to close; after an import, the one button calls `onFinished` with the workspace to open.
 */
export function WorkspaceImportCard({
  initial,
  onClose,
  finishLabel,
  onFinished,
  showTitle = true
}: {
  initial?: WorkspaceImportSummary
  onClose?: () => void
  finishLabel: string
  onFinished: (mostRecentWorktreeId: string | null) => void
  showTitle?: boolean
}): React.JSX.Element | null {
  const { state, start } = useWorkspaceImport(initial)
  // Absent in a host with no dialog; repository scripts are then left out of the import.
  const confirm = React.useContext(ConfirmationDialogContext)
  if (state.phase === 'checking') {
    return null
  }
  if (state.phase === 'absent') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate('components.workspaceImport.absent', 'No {{app}} data was found on this Mac.', {
          app: IMPORT_SOURCE_APP
        })}
      </p>
    )
  }
  const { summary } = state
  const counts = pendingCounts(summary)
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      {showTitle ? (
        <h3 className="text-sm font-semibold">
          {translate('components.workspaceImport.title', 'Import from {{app}}', {
            app: IMPORT_SOURCE_APP
          })}
        </h3>
      ) : null}
      {state.phase === 'done' ? (
        <WorkspaceImportDone
          result={state.result}
          finishLabel={finishLabel}
          onFinish={() => onFinished(state.result.mostRecentWorktreeId)}
        />
      ) : state.phase === 'importing' ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {translate('components.workspaceImport.importing', 'Importing…')}
          </p>
          <Progress
            value={
              state.progress && state.progress.total > 0
                ? (state.progress.done / state.progress.total) * 100
                : 0
            }
          />
        </div>
      ) : counts.workspaces === 0 && counts.chats === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'components.workspaceImport.upToDate',
            'Everything from {{app}} is already imported.',
            { app: IMPORT_SOURCE_APP }
          )}
        </p>
      ) : (
        <>
          <SummaryList summary={summary} />
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.workspaceImport.envNotice',
              "Environment variables aren't imported. Add them again in Settings → Environment."
            )}
          </p>
          {state.phase === 'failed' ? (
            <p className="text-sm text-destructive">
              {translate(
                'components.workspaceImport.failed',
                'The import stopped. Try again; what was imported stays.'
              )}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void start((scripts) => approveRepositoryScripts(scripts, confirm))}
            >
              {translate('components.workspaceImport.import', 'Import')}
            </Button>
            {onClose ? (
              <Button size="sm" variant="ghost" onClick={onClose}>
                {translate('components.workspaceImport.notNow', 'Not now')}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
