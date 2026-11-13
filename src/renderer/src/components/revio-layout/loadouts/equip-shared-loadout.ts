import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { addLoadout } from '../../../../../shared/revio-loadouts'
import type { SharedLoadout } from '../../../../../shared/revio-link'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/non-secure-context-uuid'
import { confirmWithAppDialog } from '../revio-terminal-link-confirm'

/** A link can come from anyone, so the person sees what it saves and says yes first. */
function confirmSharedLoadout(shared: SharedLoadout): Promise<boolean> {
  const lines = [
    translate('auto.components.revioLayout.loadouts.confirmName', 'Name: {{value0}}', {
      value0: shared.label
    }),
    translate('auto.components.revioLayout.loadouts.confirmAgent', 'Agent: {{value0}}', {
      value0: shared.agent
    }),
    translate('auto.components.revioLayout.loadouts.confirmModel', 'Model: {{value0}}', {
      value0: shared.model
    }),
    ...(shared.effort
      ? [
          translate('auto.components.revioLayout.loadouts.confirmEffort', 'Effort: {{value0}}', {
            value0: shared.effort
          })
        ]
      : [])
  ]
  return confirmWithAppDialog({
    title: translate('auto.components.revioLayout.loadouts.confirmTitle', 'Save this loadout?'),
    description: `${translate(
      'auto.components.revioLayout.loadouts.confirmBody',
      'A link asked to add a loadout to your saved loadouts.'
    )}\n\n${lines.join('\n')}`,
    descriptionClassName: 'whitespace-pre-wrap break-all',
    confirmLabel: translate('auto.components.revioLayout.loadouts.confirmSave', 'Save'),
    cancelLabel: translate('auto.components.revioLayout.restoreCancel', 'Cancel')
  })
}

/** Opening a shared loadout link saves it into the loadouts ("Equip"), once the person agrees. */
export async function equipSharedLoadout(shared: SharedLoadout): Promise<void> {
  if (!(await confirmSharedLoadout(shared))) {
    return
  }
  const state = useAppStore.getState()
  const next = addLoadout(state.settings?.revioLoadouts ?? [], {
    ...shared,
    id: createBrowserUuid()
  })
  if (next === 'full') {
    toast.error(
      translate(
        'components.native-chat.loadouts.full',
        'You have five loadouts. Remove one to save another.'
      )
    )
    return
  }
  if (next !== 'exists') {
    await state.updateSettings({ revioLoadouts: next })
  }
  toast.success(translate('auto.components.revioLayout.loadouts.equipped', 'Loadout equipped'))
}
