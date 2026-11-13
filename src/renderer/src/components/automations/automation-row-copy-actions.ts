import { translate } from '@/i18n/i18n'
import type { Automation } from '../../../../shared/automations-types'
import type { AutomationDraft } from './AutomationEditorDialog'
import { buildAutomationEditDraft } from './automation-edit-draft'

/** The Duplicate opens a new, unsaved routine named "Copy of …"; saving goes through the
 * normal create path. Launch preferences are left out because the create path only writes them
 * from an explicit launch edit. */
export function buildAutomationDuplicateDraft(automation: Automation): AutomationDraft {
  const {
    launchPreferences: _launchPreferences,
    agentArgs: _agentArgs,
    ...draft
  } = buildAutomationEditDraft(automation)
  return {
    ...draft,
    name: translate('auto.components.automations.rowActions.copyOf', 'Copy of {{name}}', {
      name: automation.name
    }),
    savedSchedule: null
  }
}
