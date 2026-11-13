import {
  FORK_HOME_FOLDER_NAME,
  LEGACY_HOME_FOLDER_NAME
} from '../../../../../../shared/fork-identity'

export type GitAvailability = 'checking' | 'available' | 'unavailable' | 'unknown'

function pathSeparatorFor(pathValue: string): '/' | '\\' {
  return pathValue.includes('\\') ? '\\' : '/'
}

const HOME_PROJECTS = new RegExp(
  `^(?:/(?:Users|home)/[^/]+|[A-Za-z]:[\\\\/]Users[\\\\/][^\\\\/]+)[\\\\/](${FORK_HOME_FOLDER_NAME}|${LEGACY_HOME_FOLDER_NAME})[\\\\/]projects$`
)

/** The home folder name when the path is the stock projects folder of a recognized OS home; null otherwise, so an arbitrary …/projects path is never mislabeled. */
function homeProjectsFolderName(pathValue: string): string | null {
  return HOME_PROJECTS.exec(pathValue)?.[1] ?? null
}

function trimTrailingSeparators(pathValue: string): string {
  const trimmed = pathValue.replace(/[\\/]+$/, '')
  if (trimmed === '' && pathValue.startsWith('/')) {
    return '/'
  }
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}${pathSeparatorFor(pathValue)}`
  }
  return trimmed
}

export function joinCreateProjectPath(parentPath: string, childName: string): string {
  const parent = trimTrailingSeparators(parentPath.trim())
  const child = childName.trim().replace(/^[\\/]+/, '')
  if (!parent || !child) {
    return parent || child
  }
  const separator = pathSeparatorFor(parent)
  if (parent === '/' || /^[A-Za-z]:[\\/]$/.test(parent)) {
    return `${parent}${child}`
  }
  return `${parent}${separator}${child}`
}

export function getDefaultCreateProjectParent(homeDir: string): string {
  const trimmedHomeDir = trimTrailingSeparators(homeDir.trim())
  if (!trimmedHomeDir) {
    return ''
  }
  return joinCreateProjectPath(
    joinCreateProjectPath(trimmedHomeDir, FORK_HOME_FOLDER_NAME),
    'projects'
  )
}

export function getCreateProjectDefaultParentAutoFill({
  step,
  createParent,
  activeRuntimeEnvironmentId,
  defaultParent,
  createStepAutoFilled
}: {
  step: string
  createParent: string
  activeRuntimeEnvironmentId: string | null | undefined
  defaultParent?: string
  createStepAutoFilled: boolean
}): { parent: string } | null {
  if (step !== 'create' || createStepAutoFilled || createParent) {
    return null
  }
  if (activeRuntimeEnvironmentId?.trim()) {
    return null
  }
  const parent = defaultParent ?? ''
  if (!parent) {
    return null
  }
  return { parent }
}

export function formatCreateProjectParentSummary({
  parent,
  defaultParent,
  runtimeEnvironmentId,
  isRemoteHost,
  missingLocationLabel = 'location not selected',
  missingServerLocationLabel = 'host folder not selected'
}: {
  parent: string
  defaultParent: string
  runtimeEnvironmentId?: string | null
  isRemoteHost?: boolean
  missingLocationLabel?: string
  missingServerLocationLabel?: string
}): string {
  const trimmedParent = parent.trim()
  if (!trimmedParent) {
    return runtimeEnvironmentId || isRemoteHost ? missingServerLocationLabel : missingLocationLabel
  }
  const homeFolder =
    defaultParent && trimmedParent === defaultParent && !runtimeEnvironmentId && !isRemoteHost
      ? homeProjectsFolderName(trimmedParent)
      : null
  if (homeFolder) {
    return `~/${homeFolder}/projects`
  }
  return trimmedParent
}
