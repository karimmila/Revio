import { translate } from '@/i18n/i18n'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import type { WorkspaceImportRepositoryScripts } from '../../../../shared/workspace-import-types'

type Confirm = (options: ConfirmationDialogOptions) => Promise<boolean>

function scriptLines(entry: WorkspaceImportRepositoryScripts): string {
  const parts = [entry.repoName]
  if (entry.setup) {
    parts.push(
      translate('components.workspaceImport.scriptsSetup', 'Setup script:'),
      entry.setup.trim()
    )
  }
  if (entry.run) {
    parts.push(translate('components.workspaceImport.scriptsRun', 'Run action:'), entry.run.trim())
  }
  return parts.join('\n')
}

/**
 * Scripts a repository commits came with its code, so the import stores them only after the
 * person has seen them and said yes. Returns the hashes of what was approved: main stores a
 * script only when its text still hashes to one of them. With no dialog, or on No, none are.
 */
export async function approveRepositoryScripts(
  scripts: readonly WorkspaceImportRepositoryScripts[],
  confirm: Confirm | null
): Promise<string[]> {
  if (scripts.length === 0 || !confirm) {
    return []
  }
  const approved = await confirm({
    title: translate('components.workspaceImport.scriptsTitle', 'Import these scripts?'),
    description: `${translate(
      'components.workspaceImport.scriptsBody',
      'These scripts come from files the repositories commit. Once imported, the setup script runs on your Mac when you create a workspace, and the run action runs from the Run button.'
    )}\n\n${scripts.map(scriptLines).join('\n\n')}`,
    descriptionClassName: 'max-h-72 overflow-auto whitespace-pre-wrap break-words',
    surface: 'security',
    confirmLabel: translate('components.workspaceImport.scriptsImport', 'Import scripts'),
    cancelLabel: translate('components.workspaceImport.scriptsSkip', 'Import without them')
  })
  return approved ? scripts.map((entry) => entry.hash) : []
}
