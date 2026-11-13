import { translate } from '@/i18n/i18n'

type TrustedScriptKind = 'setup' | 'archive' | 'issueCommand' | 'vmRecipe'

/** The confirm button names what it runs: the prompt asks about one script, never "hooks". */
export function trustDialogRunLabel(kind: TrustedScriptKind): string {
  switch (kind) {
    case 'setup':
      return translate(
        'auto.components.sidebar.OrcaYamlTrustDialog.runSetupScript',
        'Run setup script'
      )
    case 'archive':
      return translate(
        'auto.components.sidebar.OrcaYamlTrustDialog.runArchiveScript',
        'Run archive script'
      )
    case 'issueCommand':
      return translate('auto.components.sidebar.OrcaYamlTrustDialog.runCommand', 'Run command')
    case 'vmRecipe':
      return translate('auto.components.sidebar.OrcaYamlTrustDialog.runScript', 'Run script')
  }
}
