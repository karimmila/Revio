import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { FORK_PRODUCT_NAME } from '../../../../shared/fork-identity'
import { IMPORT_SOURCE_APP } from '../../../../shared/import-source-app'
import type { WorkspaceImportResult } from '../../../../shared/workspace-import-types'

export function WorkspaceImportDone({
  result,
  finishLabel,
  onFinish
}: {
  result: WorkspaceImportResult
  finishLabel: string
  onFinish: () => void
}): React.JSX.Element {
  const deniedFolders = [
    ...new Set(
      result.skipped.flatMap((skip) =>
        skip.reason === 'folder-access-denied' && skip.folder ? [skip.folder] : []
      )
    )
  ]
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">
        {translate(
          'components.workspaceImport.doneLine',
          'Imported {{workspaces}} workspaces and {{chats}} chats. Use them in {{product}} from now on, not in {{app}}.',
          {
            workspaces: result.workspaces,
            chats: result.chats,
            product: FORK_PRODUCT_NAME,
            app: IMPORT_SOURCE_APP
          }
        )}
      </p>
      {result.changesKeptAside.length > 0 ? (
        <p className="text-muted-foreground">
          {translate(
            'components.workspaceImport.keptAside',
            "Some uncommitted changes didn't apply cleanly and are in the .revio-import folder of: {{names}}",
            { names: result.changesKeptAside.join(', ') }
          )}
        </p>
      ) : null}
      {result.skipped.length > 0 ? (
        <p className="text-muted-foreground">
          {translate('components.workspaceImport.skipped', "Couldn't import: {{names}}", {
            names: result.skipped.map((skip) => skip.name).join(', ')
          })}
        </p>
      ) : null}
      {deniedFolders.map((folder) => (
        <p key={folder} className="break-words text-muted-foreground">
          {translate(
            'components.workspaceImport.folderDenied',
            'Could not read {{folder}}: allow {{product}} in System Settings › Privacy & Security › Files and Folders',
            { folder, product: FORK_PRODUCT_NAME }
          )}
        </p>
      ))}
      <Button size="sm" onClick={onFinish}>
        {finishLabel}
      </Button>
    </div>
  )
}
