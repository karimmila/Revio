import { CLAUDE_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-claude-placeholder'
import { CLOUD_SANDBOX_ENV } from '../../shared/cloud/cloud-sandbox-host'
import {
  readCloudEnvironmentKeys,
  readCloudValues
} from '../workspace-variables/workspace-variables-files'
import { readVercelCredentials } from '../vercel-cloud/vercel-cloud-credentials'
import { readAllGithubTokens } from './cloud-github-access'
import { readAgentCredentials } from '../agent-credentials/agent-credentials-store'
import { readCloudClaudeToken } from './cloud-claude-token'
import { sandboxEnvironmentScript } from './cloud-ssh-access'
import type { Sandbox } from '@vercel/sandbox'
import { runSandboxScript } from './cloud-sandbox-run'
import {
  CLOUD_SCRIPT_ENV_FILE,
  SOURCE_CLOUD_SCRIPT_ENV
} from '../../shared/cloud/cloud-script-env-file'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'

/** Credential names a sandbox's /etc/environment never carries; scripts may get marked ones. */
export const SANDBOX_CREDENTIAL_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'GH_TOKEN',
  'GITHUB_TOKEN'
] as const

const CREDENTIAL_KEYS = new Set<string>(SANDBOX_CREDENTIAL_KEYS)

/**
 * Sorts a repo's "Send to cloud" values for a sandbox. A value equal to a secret only Orca keeps
 * (agent API keys, the Claude token, every GitHub token, the Vercel credentials) is dropped
 * everywhere, under any name. Every other value goes only to scripts (setup, wake, install, Run
 * actions) unless the person opted that variable into /etc/environment, which every shell and
 * agent in the sandbox reads. Credential names never go there, opted in or not: Claude would
 * pick them up instead of the broker.
 */
export function splitSandboxValues(
  repoValues: Record<string, string>,
  secrets: readonly (string | null | undefined)[],
  environmentKeys: ReadonlySet<string> = new Set()
): {
  environment: Record<string, string>
  scriptOnly: Record<string, string>
  dropped: string[]
} {
  const known = new Set(secrets.filter((secret): secret is string => !!secret?.trim()))
  const environment: Record<string, string> = {}
  const scriptOnly: Record<string, string> = {}
  const dropped: string[] = []
  for (const [key, value] of Object.entries(repoValues)) {
    if (known.has(value) || known.has(value.trim())) {
      dropped.push(key)
    } else if (environmentKeys.has(key) && !CREDENTIAL_KEYS.has(key)) {
      environment[key] = value
    } else {
      scriptOnly[key] = value
    }
  }
  return { environment, scriptOnly, dropped }
}

/**
 * Claude Code's error reporting, telemetry and other non-inference traffic stay off in a sandbox:
 * the allowlist does not pass them, and they would carry repository paths off the box.
 */
export const SANDBOX_QUIET_ENV: Readonly<Record<string, string>> = {
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
}

/** The /etc/environment values: opted-in values plus the quiet flags and the placeholders. */
export function sandboxEnvironmentValues(
  environment: Record<string, string>,
  claudeToken: string | null,
  githubPlaceholder: string
): Record<string, string> {
  return {
    ...environment,
    ...SANDBOX_QUIET_ENV,
    [CLOUD_SANDBOX_ENV]: '1',
    ...(claudeToken ? { CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_PLACEHOLDER_TOKEN } : {}),
    GH_TOKEN: githubPlaceholder
  }
}

/** The script-only values as a file of `export NAME='value'` lines, for CLOUD_SCRIPT_ENV_FILE. */
export function scriptEnvFileContent(scriptOnly: Record<string, string>): string {
  return Object.entries(scriptOnly)
    .filter(([name]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    .map(([name, value]) => `export ${name}='${value.replace(/'/g, `'\\''`)}'\n`)
    .join('')
}

function vercelSecrets(): (string | null)[] {
  try {
    const stored = readVercelCredentials()
    return [stored?.accessToken ?? null, stored?.refreshToken ?? null]
  } catch {
    return []
  }
}

/** This Mac's secrets a sandbox must never receive, every sealed one Orca keeps. */
function localSecrets(extra: readonly (string | null)[] = []): (string | null | undefined)[] {
  return [
    readCloudClaudeToken(),
    ...extra,
    ...readAllGithubTokens(),
    ...vercelSecrets(),
    ...Object.values(readAgentCredentials())
  ]
}

/** The environment of a script run in a repo's sandbox: marked values, Orca's secrets left out. */
export function sandboxScriptEnv(repoId: string): Record<string, string> {
  const { environment, scriptOnly } = splitSandboxValues(readCloudValues(repoId), localSecrets())
  return { ...environment, ...scriptOnly }
}

/** A new workspace's /etc/environment script, its script-only env file, and every key left out. */
export function workspaceSandboxEnvironment(
  repoId: string,
  claudeToken: string | null,
  githubToken: string | null,
  githubPlaceholder: string
): { script: string; scriptEnvFile: string; skipped: string[] } {
  const { environment, scriptOnly, dropped } = splitSandboxValues(
    readCloudValues(repoId),
    localSecrets([githubToken]),
    readCloudEnvironmentKeys(repoId)
  )
  const etc = sandboxEnvironmentScript(
    sandboxEnvironmentValues(environment, claudeToken, githubPlaceholder)
  )
  return {
    script: etc.script,
    scriptEnvFile: scriptEnvFileContent(scriptOnly),
    skipped: [...dropped, ...etc.skipped]
  }
}

/** Writes /etc/environment and the script-only env file into a new workspace's sandbox. */
export async function applyWorkspaceSandboxEnvironment(
  sandbox: Sandbox,
  environment: { script: string; scriptEnvFile: string; skipped: string[] },
  io: { signal?: AbortSignal; onStderr?: (text: string) => void }
): Promise<void> {
  const { signal } = io
  if (environment.skipped.length > 0) {
    io.onStderr?.(`Not sent (quotes, newlines or credentials): ${environment.skipped.join(', ')}\n`)
  }
  await runSandboxScript(sandbox, environment.script, { sudo: true, signal })
  await sandbox.writeFiles(
    [{ path: CLOUD_SCRIPT_ENV_FILE, content: environment.scriptEnvFile, mode: 0o600 }],
    { signal }
  )
}

/** The Setup tab's script: the script-only values, then the repo's setup script in its checkout. */
export function cloudSetupScriptContent(dir: string, setupScript: string): string {
  return `#!/usr/bin/env bash\n${SOURCE_CLOUD_SCRIPT_ENV}\ncd ${quotePosixShell(dir)}\n${setupScript}\n`
}
