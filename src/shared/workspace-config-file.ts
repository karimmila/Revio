import { FORK_CLI_COMMAND_NAME } from './fork-identity'

/** The repo file that holds shared setup, archive, issue and recipe config. */
export const WORKSPACE_CONFIG_FILE = `${FORK_CLI_COMMAND_NAME}.yaml`

/**
 * Upstream's name for the same file. It is read when WORKSPACE_CONFIG_FILE is absent, so a repo
 * set up for the upstream app works without a change.
 */
export const LEGACY_WORKSPACE_CONFIG_FILE = 'orca.yaml'

/** Picks the file to read in a repo: this app's name first, then upstream's. */
export function pickWorkspaceConfigFile(exists: (fileName: string) => boolean): string {
  return exists(WORKSPACE_CONFIG_FILE) ? WORKSPACE_CONFIG_FILE : LEGACY_WORKSPACE_CONFIG_FILE
}
