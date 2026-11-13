import type { AppState } from '@/store/types'
import { getWorktreeIdFromHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { selectWorktreeCreationSurfaceShown } from '@/lib/workspace/creation/worktree-creation-surface'

type ListedWorktree = { id: string; repoId: string; isMainWorktree?: boolean }

/** The listed worktree a creation makes: its reported id, or a cloud sandbox's checkout root. */
function isCreationListed(
  creation: AppState['pendingWorktreeCreations'][string],
  listed: readonly ListedWorktree[],
  listedIds: ReadonlySet<string>
): boolean {
  if (creation.worktreeId !== undefined && listedIds.has(creation.worktreeId)) {
    return true
  }
  // A provisioned-root sandbox is its project's own checkout: once preparation hands the request the
  // sandbox's project, that project's main worktree is this creation's workspace.
  const { request } = creation
  return (
    request.ephemeralVmCheckoutMode === 'provisioned-root' &&
    request.ephemeralVmRuntimeId !== undefined &&
    listed.some((worktree) => worktree.repoId === request.repoId && worktree.isMainWorktree)
  )
}

/**
 * The workspace layout shows a new workspace as one row. Once a creation's worktree is listed, its
 * real row replaces the pending one in the same render, so the two never show together.
 */
export function withoutListedCreations<T extends { creationId: string }>(
  pending: readonly T[],
  creations: AppState['pendingWorktreeCreations'] | undefined,
  listed: readonly ListedWorktree[]
): T[] {
  const listedIds = new Set(listed.map((worktree) => worktree.id))
  return pending.filter((entry) => {
    const creation = creations?.[entry.creationId]
    return !(
      creation &&
      creation.status !== 'error' &&
      isCreationListed(creation, listed, listedIds)
    )
  })
}

/**
 * What decides which pending rows are listed, as one string: the sidebar re-plans its rows when a
 * creation learns its worktree or its sandbox project, not only when creations come and go.
 */
export function selectPendingCreationListingKey(
  creations: AppState['pendingWorktreeCreations'] | undefined
): string {
  return Object.values(creations ?? {})
    .map(
      (creation) =>
        `${creation.creationId}:${creation.status}:${creation.worktreeId ?? ''}:${creation.request.repoId}`
    )
    .join('|')
}

/** The sidebar's pending-creation rows from their `creationId repoId` keys. */
export function pendingCreationRows(
  keys: readonly string[],
  revioLayout: boolean,
  creations: AppState['pendingWorktreeCreations'] | undefined,
  worktrees: readonly ListedWorktree[]
): { creationId: string; repoId: string }[] {
  const entries = keys.map((key) => {
    const separator = key.indexOf(' ')
    return { creationId: key.slice(0, separator), repoId: key.slice(separator + 1) }
  })
  return revioLayout ? withoutListedCreations(entries, creations, worktrees) : entries
}

/**
 * The listed worktree of the creation on screen: its row reads as selected while the creation
 * hands over to it, as the pending row did, until the workspace itself becomes active.
 */
export function selectShownCreationWorktreeId(
  state: Pick<
    AppState,
    'activeView' | 'activePendingCreationId' | 'pendingWorktreeCreations' | 'settings'
  >
): string | null {
  return state.settings?.revioLayout === true &&
    selectWorktreeCreationSurfaceShown(state) &&
    state.activePendingCreationId
    ? (state.pendingWorktreeCreations[state.activePendingCreationId]?.worktreeId ?? null)
    : null
}

/** The worktree ids of creations still being set up whose worktree is already listed, as one key. */
export function selectSettingUpWorktreeIdsKey(
  state: Pick<AppState, 'pendingWorktreeCreations' | 'settings'>
): string {
  if (state.settings?.revioLayout !== true) {
    return ''
  }
  return Object.values(state.pendingWorktreeCreations)
    .flatMap((creation) =>
      creation.status === 'creating' && creation.worktreeId ? [creation.worktreeId] : []
    )
    .join('\n')
}

/**
 * The pending row sits first in its section, so the listed row that replaces it goes there too
 * until the creation ends: the row turns real in place instead of jumping to its sorted spot.
 */
export function withSettingUpRowsFirst(
  sortedIds: string[],
  settingUpWorktreeIdsKey: string
): string[] {
  if (!settingUpWorktreeIdsKey) {
    return sortedIds
  }
  const settingUp = new Set(settingUpWorktreeIdsKey.split('\n'))
  const first = sortedIds.filter((identity) =>
    settingUp.has(getWorktreeIdFromHostIdentity(identity))
  )
  return first.length === 0
    ? sortedIds
    : [...first, ...sortedIds.filter((identity) => !first.includes(identity))]
}
