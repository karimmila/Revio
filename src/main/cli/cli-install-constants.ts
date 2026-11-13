import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'
// Packaged builds install the fork's own command so a real Orca keeps /usr/local/bin/orca.
export const PACKAGED_COMMAND_NAME = FORK_CLI_COMMAND_NAME
export const DEFAULT_MAC_COMMAND_PATH = `/usr/local/bin/${PACKAGED_COMMAND_NAME}`
export const DEV_COMMAND_NAME = 'orca-dev'
export const LEGACY_LINUX_COMMAND_NAME = 'orca'
export const DEV_LAUNCHER_DIR = ['cli', 'bin'] as const
// Cold PowerShell start plus the WM_SETTINGCHANGE broadcast exceeded 5 s on low-spec machines.
export const WINDOWS_PATH_WRITE_TIMEOUT_MS = 15_000
