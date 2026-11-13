/*
 * What to run when a command-line tool this app drives is not on the computer. One place, so the
 * onboarding list, the Home banner and each point-of-use error name the same command.
 */
export type RequiredTool = 'git' | 'gh' | 'claude'

export const CLAUDE_CODE_INSTALL_COMMAND = 'curl -fsSL https://claude.ai/install.sh | bash'

const INSTALL_COMMANDS: Record<RequiredTool, { darwin: string; other: string | null }> = {
  // /usr/bin/git on a stock Mac is a stub until Apple's command line tools are installed.
  git: { darwin: 'xcode-select --install', other: null },
  gh: { darwin: 'brew install gh', other: null },
  claude: { darwin: CLAUDE_CODE_INSTALL_COMMAND, other: CLAUDE_CODE_INSTALL_COMMAND }
}

const INSTALL_PAGES: Record<RequiredTool, string> = {
  git: 'https://git-scm.com/downloads',
  gh: 'https://cli.github.com',
  claude: 'https://docs.claude.com/en/docs/claude-code/setup'
}

/** The terminal command that installs `tool` on `platform`; null where no single command fits. */
export function requiredToolInstallCommand(tool: RequiredTool, platform: string): string | null {
  const commands = INSTALL_COMMANDS[tool]
  return platform === 'darwin' ? commands.darwin : commands.other
}

export function requiredToolInstallPage(tool: RequiredTool): string {
  return INSTALL_PAGES[tool]
}

/** English sentence for main-process errors, e.g. "Install it with: brew install gh". */
export function requiredToolInstallHint(tool: RequiredTool, platform: string): string {
  const command = requiredToolInstallCommand(tool, platform)
  return command ? `Install it with: ${command}` : `Install it from ${INSTALL_PAGES[tool]}`
}

/** True for the error Node raises when the program itself is not on PATH. */
export function isProgramMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT' &&
    'syscall' in error &&
    typeof error.syscall === 'string' &&
    error.syscall.startsWith('spawn')
  )
}
