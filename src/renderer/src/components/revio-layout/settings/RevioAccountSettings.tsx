import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { LinearApiKeyDialog } from '@/components/linear-api-key-dialog'
import { RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { RevioCloudGithub } from './RevioCloudGithub'
import { RevioToolApprovalRows } from './RevioToolApprovalRows'

function MachineNameControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [draft, setDraft] = React.useState(settings.machineName)
  const commit = (): void => {
    const next = draft.trim()
    if (next && next !== settings.machineName) {
      update({ machineName: next })
    }
  }
  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
      aria-label={translate('auto.components.revioLayout.settings.name', 'Name')}
      className="h-8 w-64"
    />
  )
}

function LinearControl(): React.JSX.Element {
  const connected = useAppStore((s) => s.linearStatus.connected)
  const disconnectLinear = useAppStore((s) => s.disconnectLinear)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  return (
    <>
      {connected ? (
        <>
          <span data-revio-settings-status="">
            {translate('auto.components.revioLayout.settings.connected', 'Connected')}
          </span>
          <button
            type="button"
            data-revio-settings-button=""
            onClick={() => void disconnectLinear()}
          >
            {translate('auto.components.revioLayout.settings.disconnect', 'Disconnect')}
          </button>
        </>
      ) : (
        <button type="button" data-revio-settings-button="" onClick={() => setDialogOpen(true)}>
          {translate('auto.components.revioLayout.settings.connect', 'Connect')}
        </button>
      )}
      <LinearApiKeyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

export function RevioAccountSettings(): React.JSX.Element {
  return (
    <RevioSettingsPage title={translate('auto.components.revioLayout.settings.account', 'Account')}>
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.name', 'Name')}
        description={translate(
          'auto.components.revioLayout.settings.nameDescription',
          'The name other devices see for this Mac.'
        )}
        control={<MachineNameControl />}
      />
      <RevioCloudGithub
        signedOutText={translate(
          'auto.components.revioLayout.settings.githubAppDescription',
          '{{productName}} uses its GitHub App sign-in to create PRs, load comments and more, on this Mac and in the cloud.'
        )}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.linear', 'Linear')}
        description={translate(
          'auto.components.revioLayout.settings.linearDescription',
          'Connect Linear so agents can use issue context from your account.'
        )}
        control={<LinearControl />}
      />
      <RevioToolApprovalRows />
    </RevioSettingsPage>
  )
}
