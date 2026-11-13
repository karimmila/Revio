import { getRuntimePathBasename } from '../../shared/cross-platform-path'
import { TERMINAL_GIT_CREDENTIAL_GUARD_POLICY_ENV } from '../../shared/shell/launch/terminal-git-credential-guard'
import type { Repo } from '../../shared/repo-types'
import { getRepoRoutingConnectionId } from '../../shared/execution-host'
import {
  createWorkspacePortAllocator,
  defaultBranchName
} from '../../shared/workspace-port-allocation'

import { readEnvVarFiles } from './env-var-files'
import { IMPORTED_SCRIPT_ENV } from '../../shared/import-source-app'
import { FORK_SCRIPT_ENV } from '../../shared/workspace-script-env'

const workspacePort = createWorkspacePortAllocator()

/**
 * The workspace script environment, under this app's names (FORK_SCRIPT_ENV), under the ORCA_*
 * names older scripts read, and under the names imported scripts read:
 * workspace name and path, root path, target branch, port block start, and 1 for a workspace on
 * this Mac (main runs these scripts locally or over SSH, never in a cloud sandbox).
 */
export function getWorkspaceScriptEnvVars(
  repo: Repo,
  worktreePath: string
): Record<string, string> {
  const name = getRuntimePathBasename(worktreePath)
  const port = String(workspacePort(worktreePath))
  const branch = defaultBranchName(repo.worktreeBaseRef)
  const isLocal = getRepoRoutingConnectionId(repo) ? '0' : '1'
  return {
    ORCA_WORKSPACE_PATH: worktreePath,
    ORCA_PORT: port,
    ORCA_IS_LOCAL: isLocal,
    ...(branch
      ? {
          ORCA_DEFAULT_BRANCH: branch,
          [FORK_SCRIPT_ENV.defaultBranch]: branch,
          [IMPORTED_SCRIPT_ENV.defaultBranch]: branch
        }
      : {}),
    [FORK_SCRIPT_ENV.workspaceName]: name,
    [FORK_SCRIPT_ENV.workspacePath]: worktreePath,
    [FORK_SCRIPT_ENV.port]: port,
    [FORK_SCRIPT_ENV.isLocal]: isLocal,
    [IMPORTED_SCRIPT_ENV.workspaceName]: name,
    [IMPORTED_SCRIPT_ENV.workspacePath]: worktreePath,
    [IMPORTED_SCRIPT_ENV.port]: port,
    [IMPORTED_SCRIPT_ENV.isLocal]: isLocal
  }
}

// Keep WSL path translation in pty/wsl-orca-env.ts in sync; names and policies are not paths.
export const SETUP_RUNNER_PATH_ENV_KEYS = [
  'ORCA_ROOT_PATH',
  'ORCA_WORKTREE_PATH',
  FORK_SCRIPT_ENV.rootPath,
  FORK_SCRIPT_ENV.worktreePath,
  IMPORTED_SCRIPT_ENV.rootPath,
  'GHOSTX_ROOT_PATH',
  'ORCA_WORKSPACE_PATH',
  FORK_SCRIPT_ENV.workspacePath,
  IMPORTED_SCRIPT_ENV.workspacePath
] as const

export function getSetupEnvVars(repo: Repo, worktreePath: string): Record<string, string> {
  return {
    // Env files first, so Orca's own variables always win over a file's.
    ...readEnvVarFiles(repo.id, worktreePath),
    ...getWorkspaceScriptEnvVars(repo, worktreePath),
    ORCA_ROOT_PATH: repo.path,
    ORCA_WORKTREE_PATH: worktreePath,
    ORCA_WORKSPACE_NAME: getRuntimePathBasename(worktreePath),
    [FORK_SCRIPT_ENV.rootPath]: repo.path,
    [FORK_SCRIPT_ENV.worktreePath]: worktreePath,
    // Imported setup scripts read the root under the import source's name.
    [IMPORTED_SCRIPT_ENV.rootPath]: repo.path,
    GHOSTX_ROOT_PATH: repo.path
  }
}

export function getSetupRunnerEnvVars(repo: Repo, worktreePath: string): Record<string, string> {
  return {
    ...getSetupEnvVars(repo, worktreePath),
    // Unattended setup always needs credential protection, regardless of user opt-out.
    [TERMINAL_GIT_CREDENTIAL_GUARD_POLICY_ENV]: 'guard'
  }
}
