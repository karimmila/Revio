import { FORK_CLI_COMMAND_NAME } from './fork-identity'

/** `REVIO` for a command named `revio`: the prefix of this app's own script variables. */
export const FORK_SCRIPT_ENV_PREFIX = FORK_CLI_COMMAND_NAME.toUpperCase().replace(/[^A-Z0-9]/g, '_')

/**
 * The workspace script environment under this app's name. Setup, archive and run scripts get
 * these beside the ORCA_* names, which stay so scripts written for the upstream app keep working.
 */
export const FORK_SCRIPT_ENV = {
  rootPath: `${FORK_SCRIPT_ENV_PREFIX}_ROOT_PATH`,
  worktreePath: `${FORK_SCRIPT_ENV_PREFIX}_WORKTREE_PATH`,
  workspacePath: `${FORK_SCRIPT_ENV_PREFIX}_WORKSPACE_PATH`,
  workspaceName: `${FORK_SCRIPT_ENV_PREFIX}_WORKSPACE_NAME`,
  port: `${FORK_SCRIPT_ENV_PREFIX}_PORT`,
  isLocal: `${FORK_SCRIPT_ENV_PREFIX}_IS_LOCAL`,
  defaultBranch: `${FORK_SCRIPT_ENV_PREFIX}_DEFAULT_BRANCH`
}
