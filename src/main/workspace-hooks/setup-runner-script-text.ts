import {
  isShebangLine,
  parseSetupScriptShebang,
  stripLeadingShebangLine
} from '../../shared/workspace-setup/setup-script-shebang'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

// Reject POSIX scripts before cmd can leave setup half-applied.
const WINDOWS_RUNNER_SHEBANG_REFUSAL = [
  `echo ${FORK_PRODUCT_NAME} setup: this script starts with a "#!" interpreter line, so it needs a POSIX shell. 1>&2`,
  `echo ${FORK_PRODUCT_NAME} setup: this worktree runs setup through cmd.exe, which cannot execute it. 1>&2`,
  `echo ${FORK_PRODUCT_NAME} setup: set the Windows terminal shell to Git Bash, or rewrite the script in cmd syntax. 1>&2`,
  'exit /b 1',
  ''
].join('\r\n')

export function buildWindowsRunnerScript(script: string): string {
  // Inherited delayed expansion would consume literal ! characters in user scripts.
  const header = '@echo off\r\nsetlocal EnableExtensions DisableDelayedExpansion\r\n'
  let runnerScript = header
  let isFirstLine = true

  for (const rawLine of iterateLfScriptLines(script)) {
    const command = rawLine.trim()
    if (isFirstLine) {
      isFirstLine = false
      if (isShebangLine(command)) {
        return `${header}${WINDOWS_RUNNER_SHEBANG_REFUSAL}`
      }
    }
    if (!command) {
      runnerScript += '\r\n'
      continue
    }

    // call returns from npm/pnpm batch shims; stop immediately on failure.
    runnerScript += `call ${command}\r\nif errorlevel 1 exit /b %errorlevel%\r\n`
  }

  return runnerScript
}

export function* iterateLfScriptLines(script: string): Generator<string> {
  let lineStart = 0

  for (let index = 0; index < script.length; index++) {
    if (script.charCodeAt(index) !== 10) {
      continue
    }
    const lineEnd = index > lineStart && script.charCodeAt(index - 1) === 13 ? index - 1 : index
    yield script.slice(lineStart, lineEnd)
    lineStart = index + 1
  }

  if (lineStart <= script.length) {
    yield script.slice(lineStart)
  }
}

/** Beside the runner in the worktree's git dir; main reads it for `setup:status`. */
export const SETUP_STATUS_FILE = 'setup-status'

/**
 * The runner's first lines: "running" while the script runs, then its exit code, in
 * SETUP_STATUS_FILE. That is the signal behind the sidebar's "Setting up…" / "Initialization
 * failed" and Auto-run after setup. Best effort: a read-only git dir must not fail setup.
 */
export const POSIX_RUNNER_HEADER = [
  '#!/usr/bin/env bash',
  `orca_setup_status="$(dirname "$0")/${SETUP_STATUS_FILE}"`,
  `printf running > "$orca_setup_status" 2>/dev/null || true`,
  `trap 'printf "%s" "$?" > "$orca_setup_status" 2>/dev/null || true' EXIT`,
  ''
].join('\n')

export function buildPosixRunnerScript(script: string): string {
  // bash <path> ignores shebang flags; replay them explicitly.
  const shebang = parseSetupScriptShebang(script)
  const declaredOptions = shebang?.shellOptions.length
    ? `set ${shebang.shellOptions.join(' ')}\n`
    : ''
  const body = shebang ? stripLeadingShebangLine(script) : script
  return `${POSIX_RUNNER_HEADER}set -e\n${declaredOptions}${normalizeCrlfScriptLineEndings(body)}\n`
}

function normalizeCrlfScriptLineEndings(script: string): string {
  let crlfStart = script.indexOf('\r\n')
  if (crlfStart === -1) {
    return script
  }

  let normalized = script.slice(0, crlfStart)
  let chunkStart = crlfStart + 2
  normalized += '\n'
  crlfStart = script.indexOf('\r\n', chunkStart)

  while (crlfStart !== -1) {
    normalized += script.slice(chunkStart, crlfStart)
    normalized += '\n'
    chunkStart = crlfStart + 2
    crlfStart = script.indexOf('\r\n', chunkStart)
  }

  return `${normalized}${script.slice(chunkStart)}`
}
