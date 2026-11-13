import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { primaryAgentCatalogEntries } from '@/lib/agent-catalog-entries-primary'
import {
  installManagedRuntime,
  readManagedRuntimeInstall
} from '@/runtime/managed-runtime-install-status'
import {
  useManagedRuntimeInstall,
  type ManagedRuntimeInstallObservation
} from '@/runtime/use-managed-runtime-install'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { RevioSettingRow } from './RevioSettingsRows'
import { RevioAcpInstallDialog } from './RevioAcpInstallDialog'
import {
  REVIO_ACP_AGENTS,
  revioAcpInstallConfirmation,
  revioAcpInstalling,
  revioAcpInstallOutcome,
  revioManagedAcpAction,
  revioManagedAcpBadge,
  revioPathAcpBadge,
  type RevioAcpBadge
} from './revio-acp-install'

const LOCAL_HOST: RuntimeClientTarget = { kind: 'local' }

function badgeText(badge: RevioAcpBadge): string {
  switch (badge.kind) {
    case 'checking':
      return translate('auto.components.revioLayout.settings.acpChecking', 'Checking')
    case 'installed':
      return badge.version
        ? translate(
            'auto.components.revioLayout.settings.acpInstalledVersion',
            'Installed {{version}}',
            { version: badge.version }
          )
        : translate('auto.components.revioLayout.settings.acpInstalled', 'Installed')
    case 'missing':
      return translate('auto.components.revioLayout.settings.acpMissing', 'Missing')
    case 'updateRequired':
      return translate('auto.components.revioLayout.settings.acpUpdateRequired', 'Update required')
    case 'needsRepair':
      return translate('auto.components.revioLayout.settings.acpNeedsRepair', 'Needs repair')
  }
}

function Badge({ badge }: { badge: RevioAcpBadge }): React.JSX.Element {
  return (
    <span data-revio-acp-badge="" data-tone={badge.kind}>
      {badgeText(badge)}
    </span>
  )
}

function DocsButton({ url }: { url: string | undefined }): React.JSX.Element | null {
  if (!url) {
    return null
  }
  return (
    <button
      type="button"
      data-revio-settings-text-button=""
      onClick={() => void window.api.shell.openUrl(url)}
    >
      {translate('auto.components.revioLayout.settings.acpDocs', 'Docs')}
    </button>
  )
}

type AgentFacts = { agent: string; label: string; docsUrl: string | undefined }

function failureText(label: string, error: string): string {
  return translate(
    'auto.components.revioLayout.settings.acpInstallFailed',
    'Failed to install {{agent}}: {{error}}',
    { agent: label, error }
  )
}

function ManagedAcpAgentRow({
  facts,
  observation
}: {
  facts: AgentFacts
  observation: Extract<ManagedRuntimeInstallObservation, { kind: 'active' }>
}): React.JSX.Element {
  const { subject, snapshot } = observation
  const { label } = facts
  const [confirming, setConfirming] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [awaited, setAwaited] = React.useState<string | null>(null)
  // A ref, not state: the toast is the only reaction to the host's outcome, and clearing state
  // here would render the row once more with the outcome already shown.
  const reported = React.useRef<string | null>(null)
  const state = snapshot.kind === 'known' ? snapshot.state : null

  React.useEffect(() => {
    const outcome = state ? revioAcpInstallOutcome(state, awaited) : null
    if (!outcome || reported.current === awaited) {
      return
    }
    reported.current = awaited
    if (outcome.kind === 'succeeded') {
      toast.success(
        translate(
          'auto.components.revioLayout.settings.acpInstalledToast',
          'Installed {{agent}}.',
          {
            agent: label
          }
        )
      )
    } else {
      toast.error(
        failureText(
          label,
          outcome.error ??
            translate('auto.components.revioLayout.settings.acpInstallUnknown', 'unknown error')
        )
      )
    }
  }, [awaited, label, state])

  const install = (): void => {
    setConfirming(false)
    setStarting(true)
    void installManagedRuntime(subject)
      .then(() => {
        const latest = readManagedRuntimeInstall(subject)
        const operation = latest?.kind === 'known' ? latest.state.operation : null
        setAwaited(operation?.kind === 'install' ? operation.id : null)
      })
      .catch((cause: unknown) =>
        toast.error(failureText(label, cause instanceof Error ? cause.message : String(cause)))
      )
      .finally(() => setStarting(false))
  }

  const action = state ? revioManagedAcpAction(state) : null
  const confirmation = state ? revioAcpInstallConfirmation(state) : null
  const installing = starting || (state !== null && revioAcpInstalling(state))
  const idleLabel =
    action === 'update'
      ? translate('auto.components.revioLayout.settings.acpUpdate', 'Update')
      : translate('auto.components.revioLayout.settings.acpInstall', 'Install')
  return (
    <RevioSettingRow
      label={label}
      control={
        <>
          <Badge badge={revioManagedAcpBadge(snapshot)} />
          <DocsButton url={facts.docsUrl} />
          {installing || (action && confirmation) ? (
            <button
              type="button"
              data-revio-settings-button=""
              disabled={installing}
              onClick={() => setConfirming(true)}
            >
              {installing
                ? translate('auto.components.revioLayout.settings.acpInstalling', 'Installing…')
                : idleLabel}
            </button>
          ) : null}
          {action && confirmation ? (
            <RevioAcpInstallDialog
              agentLabel={label}
              action={action}
              confirmation={confirmation}
              open={confirming}
              onOpenChange={setConfirming}
              onConfirm={install}
            />
          ) : null}
        </>
      }
    />
  )
}

function AcpAgentRow({
  facts,
  detected
}: {
  facts: AgentFacts
  detected: readonly string[] | null
}): React.JSX.Element {
  const observation = useManagedRuntimeInstall(LOCAL_HOST, facts.agent, true)
  if (observation.kind === 'active') {
    return <ManagedAcpAgentRow facts={facts} observation={observation} />
  }
  const badge =
    observation.kind === 'pending'
      ? ({ kind: 'checking' } satisfies RevioAcpBadge)
      : revioPathAcpBadge(detected, facts.agent)
  return (
    <RevioSettingRow
      label={facts.label}
      control={
        <>
          <Badge badge={badge} />
          {badge.kind === 'missing' ? <DocsButton url={facts.docsUrl} /> : null}
        </>
      }
    />
  )
}

/** The ACP agent list: Orca installs only agents it pins; the rest are found on PATH. */
export function RevioAcpAgentRows(): React.JSX.Element {
  const [detected, setDetected] = React.useState<readonly string[] | null>(null)
  React.useEffect(() => {
    let current = true
    void window.api.preflight
      .detectAgents()
      .then((agents) => current && setDetected(agents))
      .catch(() => current && setDetected([]))
    return () => {
      current = false
    }
  }, [])
  const catalog = React.useMemo(() => primaryAgentCatalogEntries(), [])
  return (
    <>
      {REVIO_ACP_AGENTS.map((agent) => {
        const entry = catalog.find((candidate) => candidate.id === agent)
        const facts = { agent, label: entry?.label ?? agent, docsUrl: entry?.homepageUrl }
        return <AcpAgentRow key={agent} facts={facts} detected={detected} />
      })}
    </>
  )
}
