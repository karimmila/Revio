import React from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { RevioAcpAction, RevioAcpInstallConfirmation } from './revio-acp-install'

function Fact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div data-revio-acp-fact="">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** Nothing downloads until the user has seen where it comes from and confirmed. */
export function RevioAcpInstallDialog({
  agentLabel,
  action,
  confirmation,
  open,
  onOpenChange,
  onConfirm
}: {
  agentLabel: string
  action: RevioAcpAction
  confirmation: RevioAcpInstallConfirmation
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}): React.JSX.Element {
  const update = action === 'update'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {update
              ? translate(
                  'auto.components.revioLayout.settings.acpUpdateTitle',
                  'Update {{agent}} to {{version}}?',
                  { agent: agentLabel, version: confirmation.version }
                )
              : translate(
                  'auto.components.revioLayout.settings.acpInstallTitle',
                  'Install {{agent}} {{version}}?',
                  { agent: agentLabel, version: confirmation.version }
                )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.revioLayout.settings.acpInstallDescription',
              '{{productName}} downloads this archive and checks it against its pinned sha256 before it extracts anything. A file that does not match is deleted.'
            )}
          </DialogDescription>
        </DialogHeader>
        <dl data-revio-acp-facts="">
          <Fact
            label={translate('auto.components.revioLayout.settings.acpSource', 'Source')}
            value={confirmation.url}
          />
          <Fact
            label={translate('auto.components.revioLayout.settings.acpVersion', 'Version')}
            value={confirmation.version}
          />
          <Fact
            label={translate('auto.components.revioLayout.settings.acpSha256', 'sha256')}
            value={confirmation.archiveSha256}
          />
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {translate('auto.components.revioLayout.settings.acpCancel', 'Cancel')}
          </Button>
          <Button onClick={onConfirm}>
            {update
              ? translate('auto.components.revioLayout.settings.acpUpdate', 'Update')
              : translate('auto.components.revioLayout.settings.acpInstall', 'Install')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
