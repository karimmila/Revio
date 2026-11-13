import { profileStateSectionLabels } from './profile-state-section-labels'
import type { ProfileStateDialogTranslate } from './profile-state-startup-recovery-dialog'
import { FORK_CLI_COMMAND_NAME, FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

// Logs keep English; dialogs pass translateMain. The product name and command are i18next's global
// defaults there, so this fallback fills them too.
const ENGLISH_DEFAULTS: Record<string, string> = {
  productName: FORK_PRODUCT_NAME,
  cliCommand: FORK_CLI_COMMAND_NAME
}
const english: ProfileStateDialogTranslate = (_key, fallback, options) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (slot, name: string) => {
    if (options && Object.hasOwn(options, name)) {
      return options[name]
    }
    return Object.hasOwn(ENGLISH_DEFAULTS, name) ? ENGLISH_DEFAULTS[name] : slot
  })

type ProfileStateRecoveryFailure = {
  code: 'profile-state-recovery-required'
  dataFile: string
  databaseFile: string
  exportPaths: readonly string[]
  backupPaths?: readonly string[]
  profileId?: unknown
  repairableSections?: unknown
}

type ProfileStateAuthorityFailure = {
  code: 'ambiguous-profile-state'
  message: string
  divergence?: unknown
}

export type ProfileStateStartupFailureClass =
  | 'recovery-required'
  | 'ambiguous-authority'
  | 'revision-conflict'
  | 'writer-unavailable'
  | 'newer-schema'
  | 'publication-unavailable'

export function profileStateStartupFailureClass(
  error: unknown
): ProfileStateStartupFailureClass | undefined {
  if (isProfileStateRecoveryFailure(error)) {
    return 'recovery-required'
  }
  if (isProfileStateAuthorityFailure(error)) {
    return 'ambiguous-authority'
  }
  if (isRecord(error) && typeof error.code === 'string') {
    if (error.code === 'profile-state-publication-unavailable') {
      return 'publication-unavailable'
    }
    if (error.code === 'newer-schema') {
      return 'newer-schema'
    }
    if (error.code === 'profile-state-revision-conflict') {
      return 'revision-conflict'
    }
    if (error.code.startsWith('profile-state-writer-')) {
      return 'writer-unavailable'
    }
  }
  return undefined
}

export function isDivergedProfileStateFailure(error: unknown): boolean {
  return isProfileStateAuthorityFailure(error) && error.divergence === 'diverged-json'
}

export function formatProfileStateStartupFailure(
  error: unknown,
  translate: ProfileStateDialogTranslate = english
): string | undefined {
  if (isProfileStateRecoveryFailure(error)) {
    const noneFound = `  ${translate('profileState.startupFailure.noneFound', '(none found)')}`
    const retainedBackups = !error.backupPaths?.length
      ? noneFound
      : error.backupPaths.map((path) => `  ${path}`).join('\n')
    const retainedExports =
      error.exportPaths.length === 0
        ? noneFound
        : error.exportPaths.map((path) => `  ${path}`).join('\n')
    const sqlitePath = translate(
      'profileState.startupFailure.sqlitePath',
      'SQLite path: {{path}}',
      { path: error.databaseFile }
    )
    const damagedSections = repairableSectionDomains(error)
    if (damagedSections !== undefined && typeof error.profileId === 'string') {
      return [
        translate(
          'profileState.startupFailure.sectionsDamaged',
          "Part of this profile's saved state is damaged: {{sections}}. Everything else is intact.",
          {
            sections: profileStateSectionLabels(damagedSections, translate).join(', ')
          }
        ),
        translate(
          'profileState.startupFailure.repairCommand',
          'Stop {{productName}}, then run `{{command}}` to repair only the damaged parts and keep everything else. {{productName}} keeps a copy of the damaged file.',
          {
            command: `${FORK_CLI_COMMAND_NAME} profile state rollback --repair --profile-id ${error.profileId}`
          }
        ),
        sqlitePath,
        translate(
          'profileState.startupFailure.restoreWholeBackup',
          'To restore a whole backup instead, run `{{exportsCommand}}`, then `{{rollbackCommand}}`.',
          {
            exportsCommand: `${FORK_CLI_COMMAND_NAME} profile state exports`,
            rollbackCommand: `${FORK_CLI_COMMAND_NAME} profile state rollback --backup <id>`
          }
        )
      ].join('\n')
    }
    return [
      translate(
        'profileState.startupFailure.sqliteUnreadable',
        '{{productName}} cannot safely open the active profile because its SQLite state is unreadable.'
      ),
      translate('profileState.startupFailure.legacyJsonPath', 'Legacy JSON path: {{path}}', {
        path: error.dataFile
      }),
      sqlitePath,
      translate('profileState.startupFailure.retainedBackups', 'Retained SQLite backups:'),
      retainedBackups,
      translate('profileState.startupFailure.retainedExports', 'Retained JSON exports:'),
      retainedExports,
      translate(
        'profileState.startupFailure.chooseRecoveryArtifact',
        'Stop {{productName}}, then run `{{command}}` and choose a known-good recovery artifact.',
        { command: `${FORK_CLI_COMMAND_NAME} profile state exports` }
      ),
      translate(
        'profileState.startupFailure.restoreCommands',
        'Restore SQLite with `{{backupCommand}}`, or restore a JSON export with `{{revisionCommand}}`.',
        {
          backupCommand: `${FORK_CLI_COMMAND_NAME} profile state rollback --backup <id>`,
          revisionCommand: `${FORK_CLI_COMMAND_NAME} profile state rollback --revision <revision>`
        }
      )
    ].join('\n')
  }

  if (isProfileStateAuthorityFailure(error)) {
    return [
      translate(
        'profileState.startupFailure.authorityAmbiguous',
        '{{productName}} cannot safely choose a profile-state authority: {{detail}}',
        { detail: error.message }
      ),
      translate(
        'profileState.startupFailure.authorityBothPreserved',
        'An older build may have changed the JSON file. Both copies are preserved; neither is selected automatically.'
      ),
      translate(
        'profileState.startupFailure.authorityCopyFirst',
        'Stop {{productName}} and copy the profile directory before choosing which state to keep.'
      ),
      translate(
        'profileState.startupFailure.authorityKeepJson',
        'To keep the current JSON, including edits from an older build, run `{{command}}`. This archives both copies and does not merge their contents.',
        { command: `${FORK_CLI_COMMAND_NAME} profile state rollback --current-json` }
      ),
      translate(
        'profileState.startupFailure.authorityInspect',
        'Run `{{command}}` to inspect retained recovery points.',
        { command: `${FORK_CLI_COMMAND_NAME} profile state exports` }
      ),
      translate(
        'profileState.startupFailure.authorityRestore',
        'Use `{{backupCommand}}` or `{{revisionCommand}}` only after selecting the state you want to restore.',
        {
          backupCommand: `${FORK_CLI_COMMAND_NAME} profile state rollback --backup <id>`,
          revisionCommand: `${FORK_CLI_COMMAND_NAME} profile state rollback --revision <revision>`
        }
      )
    ].join('\n')
  }

  const failureClass = profileStateStartupFailureClass(error)
  if (failureClass === 'publication-unavailable' && isRecord(error)) {
    if (typeof error.directory === 'string') {
      return profileStatePublicationFailureText(error.directory, translate)
    }
    if (typeof error.message === 'string') {
      return error.message
    }
  }
  if (failureClass === 'newer-schema') {
    return translate(
      'profileState.startupFailure.newerSchema',
      'This profile was saved by a newer version of {{productName}}. Open it with that version or a newer release. Your profile has not been changed.'
    )
  }
  if (failureClass === 'revision-conflict') {
    return translate(
      'profileState.startupFailure.revisionConflict',
      'The active profile changed while {{productName}} was starting. Close other {{productName}} processes using this profile, then restart {{productName}}.'
    )
  }
  if (failureClass === 'writer-unavailable') {
    return translate(
      'profileState.startupFailure.writerUnavailable',
      '{{productName}} could not start profile persistence. Restart {{productName}}; if the problem continues, repair or reinstall this build.'
    )
  }

  return undefined
}

/** Shared by the error's English message and the localized startup dialog. */
export function profileStatePublicationFailureText(
  directory: string,
  translate: ProfileStateDialogTranslate = english
): string {
  return [
    translate(
      'profileState.startupFailure.publicationUnavailable',
      '{{productName}} could not safely publish profile state in {{directory}}.',
      { directory }
    ),
    translate(
      'profileState.startupFailure.publicationNeedsHardLinks',
      'This location must support hard links, and {{productName}} needs permission to create them.'
    ),
    translate(
      'profileState.startupFailure.publicationMoveData',
      'Close {{productName}} and orcad before checking folder permissions or moving the complete {{productName}} data directory to a writable local filesystem that supports hard links, such as APFS, NTFS, or ext4.'
    ),
    translate(
      'profileState.startupFailure.publicationKeepFiles',
      'Keep the original directory and all recovery files.'
    )
  ].join('\n')
}

function isProfileStateRecoveryFailure(error: unknown): error is ProfileStateRecoveryFailure {
  return (
    isRecord(error) &&
    error.code === 'profile-state-recovery-required' &&
    typeof error.dataFile === 'string' &&
    typeof error.databaseFile === 'string' &&
    Array.isArray(error.exportPaths) &&
    error.exportPaths.every((path) => typeof path === 'string') &&
    (error.backupPaths === undefined ||
      (Array.isArray(error.backupPaths) &&
        error.backupPaths.every((path) => typeof path === 'string')))
  )
}

function repairableSectionDomains(error: ProfileStateRecoveryFailure): string[] | undefined {
  const sections = error.repairableSections
  if (!Array.isArray(sections) || sections.length === 0) {
    return undefined
  }
  const domains = sections.map((section: unknown) =>
    isRecord(section) && typeof section.domain === 'string' ? section.domain : undefined
  )
  return domains.every((domain): domain is string => domain !== undefined) ? domains : undefined
}

function isProfileStateAuthorityFailure(error: unknown): error is ProfileStateAuthorityFailure {
  return (
    isRecord(error) && error.code === 'ambiguous-profile-state' && typeof error.message === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
