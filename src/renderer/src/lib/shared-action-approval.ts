import { z } from 'zod'
import { translate } from '@/i18n/i18n'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import type { RepoAction } from '../../../shared/actions/repo-actions'
import { SHARED_ACTIONS_FILE } from '../../../shared/actions/repo-actions'
import { hashOrcaHookScript } from './orca-hook-trust'

/**
 * A shared action's script comes from the repository's files, so a clone or a pull can bring a
 * command the person has never seen. The first run of each script on this Mac shows it and asks;
 * the answer is kept by the script's hash, so an edited script asks again. Personal actions, which
 * the person wrote in Settings, never ask.
 */
const APPROVED_KEY = 'orca.revioApprovedSharedActions'
const MAX_APPROVED_PER_REPO = 200
const ApprovedSchema = z.record(z.string(), z.array(z.string()))

function readApproved(): Record<string, string[]> {
  try {
    const parsed = ApprovedSchema.safeParse(
      JSON.parse(window.localStorage.getItem(APPROVED_KEY) ?? '{}')
    )
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function rememberApproved(sourceRepoId: string, hash: string): void {
  const all = readApproved()
  const hashes = [hash, ...(all[sourceRepoId] ?? []).filter((entry) => entry !== hash)]
  try {
    window.localStorage.setItem(
      APPROVED_KEY,
      JSON.stringify({ ...all, [sourceRepoId]: hashes.slice(0, MAX_APPROVED_PER_REPO) })
    )
  } catch {
    // Without storage the approval lasts for this run only; the next run asks again.
  }
}

export type ConfirmDialog = (options: ConfirmationDialogOptions) => Promise<boolean>

/** True when the action may run: it is personal, already approved, or the person says yes now. */
export async function approveSharedActionRun(
  sourceRepoId: string,
  action: Pick<RepoAction, 'name' | 'script' | 'shared'>,
  confirm: ConfirmDialog
): Promise<boolean> {
  if (!action.shared) {
    return true
  }
  const hash = await hashOrcaHookScript(action.script)
  if (readApproved()[sourceRepoId]?.includes(hash)) {
    return true
  }
  // The file the action was read from, which is not the same name in every repository.
  const sharedFileName =
    (await window.api?.repoActions?.list(sourceRepoId).catch(() => null))?.sharedFileName ??
    SHARED_ACTIONS_FILE
  const approved = await confirm({
    title: translate('auto.lib.sharedActionApproval.title', 'Run “{{value0}}”?', {
      value0: action.name
    }),
    description: `${translate(
      'auto.lib.sharedActionApproval.body',
      'This action comes from the repository ({{value0}}). It runs this command on your Mac:',
      { value0: sharedFileName }
    )}\n\n${action.script.trim()}`,
    descriptionClassName: 'max-h-64 overflow-auto whitespace-pre-wrap break-words',
    surface: 'security',
    confirmLabel: translate('auto.lib.sharedActionApproval.run', 'Run'),
    cancelLabel: translate('auto.components.revioLayout.restoreCancel', 'Cancel')
  })
  if (approved) {
    rememberApproved(sourceRepoId, hash)
  }
  return approved
}
