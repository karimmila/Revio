/**
 * Names that belong to the other app whose actions and scripts can be imported. They are that
 * app's own interface, so they stay spelled out, and only here: its name on the import button,
 * the header of an action it exports, and the environment variables its scripts read.
 */
export const IMPORT_SOURCE_APP = 'Conductor'

/** The import source app's per-repository config, read for its setup and archive scripts. */
export const IMPORT_SOURCE_SETUP_CONFIG = 'conductor.json'

/** The setup-script import provider id for that config; also sent with setup-script telemetry. */
export const IMPORT_SOURCE_PROVIDER = 'conductor'

/** `# Conductor action "Name" (cloud=1 local=0)`, the first line of an exported action. */
export const IMPORTED_ACTION_HEADER =
  /^#\s*Conductor action "([^"]+)"\s*\(cloud=(\d)\s+local=(\d)\)\s*\n/

export const IMPORTED_ACTION_HEADER_PREFIX = '# Conductor action'

/** The script environment under the imported app's names, set beside the ORCA_* ones. */
export const IMPORTED_SCRIPT_ENV = {
  workspaceName: 'CONDUCTOR_WORKSPACE_NAME',
  workspacePath: 'CONDUCTOR_WORKSPACE_PATH',
  rootPath: 'CONDUCTOR_ROOT_PATH',
  port: 'CONDUCTOR_PORT',
  isLocal: 'CONDUCTOR_IS_LOCAL',
  defaultBranch: 'CONDUCTOR_DEFAULT_BRANCH'
} as const

/** Where the import source app keeps its database, under the home folder (macOS only). */
export const IMPORT_SOURCE_DATA_DIR_SEGMENTS = [
  'Library',
  'Application Support',
  'com.conductor.app'
] as const

export const IMPORT_SOURCE_DATABASE_FILE = 'conductor.db'

/** Repository scripts the import source app keeps beside the code, newest layout first. */
export const IMPORT_SOURCE_REPO_SETTINGS_FILES = [
  '.conductor/settings.local.toml',
  '.conductor/settings.toml'
] as const

/** The second database, which caches the import source app's cloud workspaces and their chats. */
export const IMPORT_SOURCE_CLOUD_DATABASE_FILE = 'cache.db'

/** Under the home folder: where the import source app keeps local copies of cloud workspaces. */
export const IMPORT_SOURCE_CLOUD_MIRROR_SEGMENTS = ['conductor', 'remote-workspace-sync'] as const
