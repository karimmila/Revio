import { translate } from '@/i18n/i18n'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'

/** Why an archived workspace cannot go back on its own branch ("Restore to new branch?"). */
export type RestoreScenario = 'branchTaken' | 'branchDiverged' | 'branchDeleted'

/** Asks the person; true restores the work on a new branch at the archive commit. */
export type ConfirmRestoreToNewBranch = (scenario: RestoreScenario) => Promise<boolean>

export function sameCommit(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && (a.startsWith(b) || b.startsWith(a))
}

/**
 * Checks the archived branch before unarchive: used by another workspace, gone, or moved past the
 * archive commit. null means the workspace can go back on its branch as it was.
 */
export async function restoreScenario(
  record: Pick<ArchivedWorkspace, 'branch' | 'archiveCommit'>,
  repoPath: string,
  branchesInUse: readonly string[]
): Promise<RestoreScenario | null> {
  const branch = record.branch
  if (!branch) {
    return null
  }
  if (branchesInUse.includes(branch)) {
    return 'branchTaken'
  }
  const compare = await window.api.git
    .refCompare({
      worktreePath: repoPath,
      baseRef: record.archiveCommit,
      headRef: `refs/heads/${branch}`
    })
    .catch(() => null)
  if (!compare) {
    // Unknown: let Orca's own create report what went wrong.
    return null
  }
  const head = compare.summary.headOid
  if (!head) {
    return 'branchDeleted'
  }
  return sameCommit(head, record.archiveCommit) ? null : 'branchDiverged'
}

/** The dialog text for each scenario. */
export function restoreScenarioText(
  scenario: RestoreScenario,
  branch: string
): { title: string; body: string } {
  const title = translate('auto.lib.revioArchive.restoreTitle', 'Restore to new branch?')
  if (scenario === 'branchTaken') {
    return {
      title,
      body: translate(
        'auto.lib.revioArchive.restoreTaken',
        'This workspace was last on {{value0}}, but that branch is being used by another workspace.',
        { value0: branch }
      )
    }
  }
  if (scenario === 'branchDiverged') {
    return {
      title,
      body: translate(
        'auto.lib.revioArchive.restoreDiverged',
        'This workspace was last on {{value0}}, but someone updated that branch in the meantime. Restore to a new branch to preserve your work.',
        { value0: branch }
      )
    }
  }
  return {
    title,
    body: translate(
      'auto.lib.revioArchive.restoreDeleted',
      'This workspace was last on {{value0}}, but that branch has been deleted or renamed.',
      { value0: branch }
    )
  }
}

/** The workspace (and branch) name a restore to a new branch uses. */
export function restoredWorkspaceName(
  record: Pick<ArchivedWorkspace, 'branch' | 'displayName'>
): string {
  const last = record.branch?.split('/').pop() || record.displayName
  return `${last}-restored`
}
