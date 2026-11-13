import { translate } from '@/i18n/i18n'
import { useState } from 'react'
import { IMPORT_SOURCE_APP } from '../../../../../shared/import-source-app'
import { WorkspaceImportCard } from '../../workspace-import/WorkspaceImportCard'
import { RevioSettingsPage } from './RevioSettingsRows'

export function RevioImportSettings(): React.JSX.Element {
  // Done closes the result; remounting checks again, so the card then shows what is left.
  const [round, setRound] = useState(0)
  return (
    <RevioSettingsPage
      title={translate('components.workspaceImport.settingsPage', 'Import')}
      description={translate(
        'components.workspaceImport.settingsLede',
        'Continue your workspaces and chats from {{app}} here. {{app}} is not changed.',
        { app: IMPORT_SOURCE_APP }
      )}
    >
      <WorkspaceImportCard
        key={round}
        finishLabel={translate('components.workspaceImport.done', 'Done')}
        onFinished={() => setRound((value) => value + 1)}
      />
    </RevioSettingsPage>
  )
}
