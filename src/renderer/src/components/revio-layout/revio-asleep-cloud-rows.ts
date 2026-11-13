import { useMemo } from 'react'
import { useAsleepCloudWorkspaces } from '@/lib/asleep-cloud-workspaces'
import type { Repo } from '../../../../shared/repo-types'
import type { PendingCreationRow, Row } from '../../../../shared/sidebar-list/row-types'
import { isCustomSectionKey } from '../../../../shared/sidebar-list/custom-section-rows'
import type { AsleepCloudWorkspace } from '../../../../shared/asleep-cloud-workspace-types'

const NONE: readonly AsleepCloudWorkspace[] = []

/** Imported cloud workspaces with no sandbox, listed only where cloud workspaces are. */
export function asleepCloudForLocation(
  records: readonly AsleepCloudWorkspace[],
  revioLayout: boolean,
  location: string | undefined
): readonly AsleepCloudWorkspace[] {
  return revioLayout && location === 'cloud' ? records : NONE
}

/**
 * Puts imported asleep cloud workspaces after the main list's workspaces, before the person's
 * own sections, newest first.
 */
export function withAsleepCloudRows(
  rows: Row[],
  records: readonly AsleepCloudWorkspace[],
  repoMap: ReadonlyMap<string, Repo>
): Row[] {
  if (records.length === 0) {
    return rows
  }
  const asleep: PendingCreationRow[] = [...records]
    .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
    .map((record) => ({
      type: 'pending-creation',
      key: `asleep-cloud:${record.id}`,
      creationId: `asleep-cloud:${record.id}`,
      repo: repoMap.get(record.repoId),
      asleepCloud: record
    }))
  const firstSection = rows.findIndex((row) => row.type === 'header' && isCustomSectionKey(row.key))
  const at = firstSection === -1 ? rows.length : firstSection
  return [...rows.slice(0, at), ...asleep, ...rows.slice(at)]
}

/** The sidebar rows with the location's asleep imported cloud workspaces added. */
export function useAsleepCloudRows(
  rows: Row[],
  settings: { revioLayout?: boolean; revioLocation?: string } | null | undefined,
  repoMap: ReadonlyMap<string, Repo>
): Row[] {
  const records = asleepCloudForLocation(
    useAsleepCloudWorkspaces(),
    settings?.revioLayout === true,
    settings?.revioLocation
  )
  return useMemo(() => withAsleepCloudRows(rows, records, repoMap), [rows, records, repoMap])
}
