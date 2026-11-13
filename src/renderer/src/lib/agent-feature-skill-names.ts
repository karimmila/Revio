// Revio's own names: upstream Orca.app installs orca-* and `orchestration` into the same folders.
export const ORCA_CLI_SKILL_NAME = 'revio-cli'
export const COMPUTER_USE_SKILL_NAME = 'revio-computer-use'
export const ORCHESTRATION_SKILL_NAME = 'revio-orchestration'
export const EPHEMERAL_VMS_SKILL_NAME = 'revio-per-workspace-env'
export const ORCA_LINEAR_SKILL_NAME = 'revio-linear'
export const LINEAR_TICKETS_SKILL_NAME = 'revio-linear-tickets'
export const LINEAR_AGENT_SKILL_NAMES = [ORCA_LINEAR_SKILL_NAME, LINEAR_TICKETS_SKILL_NAME] as const
