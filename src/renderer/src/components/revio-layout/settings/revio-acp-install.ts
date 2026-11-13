import type {
  ManagedRuntimeInstallState,
  ManagedRuntimeOperation
} from '../../../../../shared/managed-runtime-install'
import { compareAppVersions } from '../../../../../shared/app-version'
import type { ManagedRuntimeInstallSnapshot } from '@/runtime/managed-runtime-install-status'

/** The ACP agents Orca launches (src/main/acp/acp-launch-specs.ts), in the list order. */
export const REVIO_ACP_AGENTS = ['antigravity', 'grok', 'opencode', 'opencode2', 'omp'] as const

export type RevioAcpBadge =
  | { kind: 'checking' }
  | { kind: 'installed'; version: string | null }
  | { kind: 'missing' }
  | { kind: 'updateRequired' }
  | { kind: 'needsRepair' }

export type RevioAcpAction = 'install' | 'update'

export type RevioAcpInstallConfirmation = {
  version: string
  url: string
  archiveSha256: string
}

const RUNNING_PHASES: ReadonlySet<ManagedRuntimeOperation['phase']> = new Set([
  'downloading',
  'extracting',
  'verifying'
])

export function revioAcpInstalling(state: ManagedRuntimeInstallState): boolean {
  const { operation } = state
  return operation?.kind === 'install' && RUNNING_PHASES.has(operation.phase)
}

/** A copy that is not the pinned release and not newer than it; a newer one is left alone. */
function updateDue(state: ManagedRuntimeInstallState): boolean {
  const installed = state.installedVersion
  if (installed === null || state.installedCurrent) {
    return false
  }
  return state.version === null || compareAppVersions(installed, state.version) <= 0
}

export function revioAcpRemoving(state: ManagedRuntimeInstallState): boolean {
  return state.operation?.kind === 'remove' && state.operation.phase === 'removing'
}

/** The status badge for an agent Orca installs itself. */
export function revioManagedAcpBadge(
  snapshot: ManagedRuntimeInstallSnapshot | null
): RevioAcpBadge {
  if (!snapshot || snapshot.kind !== 'known') {
    return snapshot?.kind === 'readFailed' ? { kind: 'needsRepair' } : { kind: 'checking' }
  }
  const { state } = snapshot
  if (state.source === 'external') {
    return { kind: 'installed', version: null }
  }
  if (state.installedVersion !== null) {
    return updateDue(state)
      ? { kind: 'updateRequired' }
      : { kind: 'installed', version: state.installedVersion }
  }
  return state.damaged ? { kind: 'needsRepair' } : { kind: 'missing' }
}

/** Install for a missing or damaged copy, Update only when the installed one is older than the pin. */
export function revioManagedAcpAction(state: ManagedRuntimeInstallState): RevioAcpAction | null {
  if (!state.available || state.source === 'external' || revioAcpRemoving(state)) {
    return null
  }
  if (state.installedVersion !== null) {
    return updateDue(state) ? 'update' : null
  }
  return 'install'
}

/** What the confirm dialog shows; null when the host did not say where the archive comes from. */
export function revioAcpInstallConfirmation(
  state: ManagedRuntimeInstallState
): RevioAcpInstallConfirmation | null {
  const { version, downloadUrl, archiveSha256 } = state
  if (!state.available || !version || !downloadUrl || !archiveSha256) {
    return null
  }
  return { version, url: downloadUrl, archiveSha256 }
}

export type RevioAcpInstallOutcome =
  | { kind: 'succeeded' }
  | { kind: 'failed'; error: string | null }

/** The end of the install this row started, read from the host's latest operation. */
export function revioAcpInstallOutcome(
  state: ManagedRuntimeInstallState,
  awaitedOperationId: string | null
): RevioAcpInstallOutcome | null {
  const { operation } = state
  if (!awaitedOperationId || operation?.id !== awaitedOperationId || operation.kind !== 'install') {
    return null
  }
  if (operation.phase === 'succeeded') {
    return { kind: 'succeeded' }
  }
  return operation.phase === 'failed' ? { kind: 'failed', error: operation.error ?? null } : null
}

/**
 * A PATH-only agent: the workspace layout's Installed or Missing, with no version Orca can vouch
 * for.
 */
export function revioPathAcpBadge(
  detected: readonly string[] | null,
  agent: string
): RevioAcpBadge {
  if (detected === null) {
    return { kind: 'checking' }
  }
  return detected.includes(agent) ? { kind: 'installed', version: null } : { kind: 'missing' }
}
