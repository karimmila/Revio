import { describe, expect, it, vi } from 'vitest'
import {
  SANDBOX_CREDENTIAL_KEYS,
  sandboxEnvironmentValues,
  scriptEnvFileContent,
  splitSandboxValues,
  workspaceSandboxEnvironment
} from './cloud-sandbox-env'
import { sandboxEnvironmentScript } from './cloud-ssh-access'
import { CLAUDE_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-claude-placeholder'

vi.mock('@vercel/sandbox', () => ({}))

const CLAUDE = 'sk-ant-oat01-real-claude-token-from-this-mac'
const GITHUB = 'ghp_realgithubtokenfromthismac'
const OTHER_OWNER_GITHUB = 'github_pat_other_owner_token_on_this_mac'
const VERCEL = 'vca_vercel_access_token_on_this_mac'
const STORED_KEY = 'sk-ant-api03-key-orca-stores'
const MARKED_KEY = 'sk-ant-api03-key-the-app-needs'

vi.mock('../workspace-variables/workspace-variables-files', () => ({
  readCloudValues: () => ({
    DATABASE_URL: 'postgres://local',
    NODE_ENV: 'development',
    LEAKED_VERCEL: VERCEL,
    LEAKED_GITHUB: OTHER_OWNER_GITHUB
  }),
  readCloudEnvironmentKeys: () => new Set(['NODE_ENV'])
}))
vi.mock('../agent-credentials/agent-credentials-store', () => ({
  readAgentCredentials: () => ({ anthropic: STORED_KEY })
}))
vi.mock('./cloud-claude-token', () => ({ readCloudClaudeToken: () => CLAUDE }))
vi.mock('./cloud-github-access', () => ({
  readAllGithubTokens: () => [GITHUB, OTHER_OWNER_GITHUB]
}))
vi.mock('../vercel-cloud/vercel-cloud-credentials', () => ({
  readVercelCredentials: () => ({ accessToken: VERCEL, refreshToken: null })
}))

const repoValues = {
  DATABASE_URL: 'postgres://local',
  NODE_ENV: 'development',
  ANTHROPIC_API_KEY: MARKED_KEY,
  OPENAI_API_KEY: 'sk-openai-for-the-app',
  GH_TOKEN: 'ghp_user_marked',
  RENAMED_SECRET: STORED_KEY,
  ALSO_RENAMED: ` ${GITHUB} `,
  CLAUDE_CODE_OAUTH_TOKEN: CLAUDE
}
const secrets = [CLAUDE, GITHUB, STORED_KEY]

describe('sandbox environment', () => {
  const optedIn = new Set(['NODE_ENV', 'OPENAI_API_KEY'])
  const { environment, scriptOnly, dropped } = splitSandboxValues(repoValues, secrets, optedIn)
  const etc = sandboxEnvironmentScript(
    sandboxEnvironmentValues(environment, CLAUDE, 'gh-placeholder')
  ).script
  const scriptFile = scriptEnvFileContent(scriptOnly)

  it('never sends a secret only Orca keeps, under any name, anywhere', () => {
    expect(dropped.sort()).toEqual(['ALSO_RENAMED', 'CLAUDE_CODE_OAUTH_TOKEN', 'RENAMED_SECRET'])
    for (const secret of secrets) {
      expect(etc).not.toContain(secret)
      expect(scriptFile).not.toContain(secret)
    }
  })

  it('puts only opted-in, non-credential values in /etc/environment', () => {
    expect(environment).toEqual({ NODE_ENV: 'development' })
    expect(etc).toContain('NODE_ENV="development"')
    expect(etc).not.toContain('DATABASE_URL')
    for (const key of SANDBOX_CREDENTIAL_KEYS) {
      if (key !== 'CLAUDE_CODE_OAUTH_TOKEN' && key !== 'GH_TOKEN') {
        expect(etc).not.toContain(`${key}=`)
      }
    }
    expect(etc).toContain(`CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_PLACEHOLDER_TOKEN}"`)
    expect(etc).toContain('GH_TOKEN="gh-placeholder"')
    expect(etc).not.toContain(MARKED_KEY)
  })

  it('turns Claude Code telemetry and error reporting off', () => {
    expect(etc).toContain('DISABLE_TELEMETRY="1"')
    expect(etc).toContain('DISABLE_ERROR_REPORTING="1"')
    expect(etc).toContain('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"')
  })

  it('gives every other marked value to scripts only', () => {
    expect(scriptOnly).toEqual({
      DATABASE_URL: 'postgres://local',
      ANTHROPIC_API_KEY: MARKED_KEY,
      OPENAI_API_KEY: 'sk-openai-for-the-app',
      GH_TOKEN: 'ghp_user_marked'
    })
    expect(scriptFile).toContain(`export ANTHROPIC_API_KEY='${MARKED_KEY}'`)
  })

  it('defaults every value to scripts only', () => {
    const plain = splitSandboxValues({ DATABASE_URL: 'x' }, [])
    expect(plain.environment).toEqual({})
    expect(plain.scriptOnly).toEqual({ DATABASE_URL: 'x' })
  })
})

describe('a new workspace’s environment', () => {
  it('drops the Vercel token and every owner’s GitHub token wherever they were marked', () => {
    const result = workspaceSandboxEnvironment('repo-1', CLAUDE, GITHUB, 'gh-placeholder')
    expect(result.skipped).toEqual(expect.arrayContaining(['LEAKED_VERCEL', 'LEAKED_GITHUB']))
    for (const secret of [VERCEL, OTHER_OWNER_GITHUB, GITHUB, CLAUDE]) {
      expect(result.script).not.toContain(secret)
      expect(result.scriptEnvFile).not.toContain(secret)
    }
    expect(result.script).toContain('NODE_ENV="development"')
    expect(result.scriptEnvFile).toContain("export DATABASE_URL='postgres://local'")
  })
})
