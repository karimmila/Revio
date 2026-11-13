import { existsSync } from 'node:fs'
import path, { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { resolveClaudeCommand } from '../codex-cli/command'
import { CLAUDE_AUTH_ENV_VARS } from './environment'
import { userInfo } from 'node:os'
import { execSecurityCommand, isKeychainNotFoundError } from '../macos-keychain/generic-password'
import { claudeConfigDirKeychainAliases, claudeKeychainService } from './keychain'
import { readUserClaudeConfigDir, readUserClaudeConfigDirAsSet } from './claude-profile-paths'

const KEYCHAIN_ACCOUNT_PATTERN = /^[a-zA-Z0-9._-]+$/

function present(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

/** An Anthropic key or token Claude Code signs in with, read from an environment. */
export function hasClaudeApiKeyEnv(env: Record<string, string | undefined> | undefined): boolean {
  return present(env?.ANTHROPIC_API_KEY) || present(env?.ANTHROPIC_AUTH_TOKEN)
}

/**
 * Whether the Keychain holds the item. Without `-w` the `security` tool prints only the item's
 * attributes, so this never reads the secret and never shows an access prompt.
 */
export async function keychainItemExists(service: string): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return false
  }
  let user: string
  try {
    user = process.env.USER || userInfo().username
  } catch {
    user = ''
  }
  // Claude Code 2.1+ stores the item under this account name when the user name has other characters.
  const account = KEYCHAIN_ACCOUNT_PATTERN.test(user) ? user : 'claude-code-user'
  try {
    await execSecurityCommand(['find-generic-password', '-s', service, '-a', account])
    return true
  } catch (error) {
    if (!isKeychainNotFoundError(error)) {
      console.warn('[claude-login] Could not check the Claude Code Keychain item:', error)
    }
    return false
  }
}

/**
 * What `claude auth status` says about the stored login: true or false, or null when the CLI
 * could not answer (missing, too old, timed out). Its JSON names the login, never the token.
 */
export async function claudeAuthStatusLoggedIn(env: NodeJS.ProcessEnv): Promise<boolean | null> {
  try {
    const program = resolveClaudeCommand()
    const childEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        childEnv[key] = value
      }
    }
    // Keys in the environment are a separate route; this asks only about the stored login.
    for (const key of CLAUDE_AUTH_ENV_VARS) {
      delete childEnv[key]
    }
    const pathKey = process.platform === 'win32' && childEnv.Path !== undefined ? 'Path' : 'PATH'
    // Version-manager shims run /usr/bin/env node, so the CLI's own folder goes first on PATH.
    childEnv[pathKey] = [path.dirname(program), childEnv[pathKey]]
      .filter(Boolean)
      .join(path.delimiter)
    const result = await runProcess({
      program,
      args: ['auth', 'status'],
      terminationBarrier: true,
      env: childEnv,
      timeoutMs: 8_000,
      maxOutputBytes: 16_384
    })
    const parsed: unknown = JSON.parse(result.stdout)
    return parsed && typeof parsed === 'object' && 'loggedIn' in parsed
      ? parsed.loggedIn === true
      : null
  } catch {
    return null
  }
}

export type ClaudeSystemLoginDeps = {
  env: NodeJS.ProcessEnv
  userHome: string
  platform?: NodeJS.Platform
  keychainItemExists?: (service: string) => Promise<boolean>
  authStatus?: (env: NodeJS.ProcessEnv) => Promise<boolean | null>
}

/**
 * Claude Code's own login on this machine, the one `claude` in a terminal uses: a long-lived
 * OAuth token in the environment, or a stored login that `claude auth status` confirms. A
 * Keychain item can outlive its login (seen 2026-11-11: the item was there while `claude auth
 * status` said loggedIn false), so a stored file or item alone counts only when the CLI cannot
 * answer.
 */
export async function hasClaudeSystemLogin(deps: ClaudeSystemLoginDeps): Promise<boolean> {
  if (present(deps.env.CLAUDE_CODE_OAUTH_TOKEN)) {
    return true
  }
  if (!(await hasStoredClaudeLogin(deps))) {
    return false
  }
  const loggedIn = await (deps.authStatus ?? claudeAuthStatusLoggedIn)(deps.env)
  return loggedIn ?? true
}

async function hasStoredClaudeLogin(deps: ClaudeSystemLoginDeps): Promise<boolean> {
  const configDir = readUserClaudeConfigDir(deps.env)
  if (existsSync(join(configDir ?? join(deps.userHome, '.claude'), '.credentials.json'))) {
    return true
  }
  if ((deps.platform ?? process.platform) !== 'darwin') {
    return false
  }
  const exists = deps.keychainItemExists ?? keychainItemExists
  // Claude Code names the item after CLAUDE_CONFIG_DIR exactly as it was spelled.
  const spelled = readUserClaudeConfigDirAsSet(deps.env)
  const services = spelled
    ? claudeConfigDirKeychainAliases(spelled).map((dir) => claudeKeychainService(dir))
    : [claudeKeychainService()]
  for (const service of services) {
    if (await exists(service)) {
      return true
    }
  }
  return false
}
