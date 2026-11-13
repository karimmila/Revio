import type { GlobalSettings } from './global-settings-types'
import { claudeProviderFromSettings } from './claude-provider-env'

type Credentials = Partial<
  Record<'anthropicApiKey' | 'anthropicAuthToken' | 'openaiApiKey', string>
>

export type AgentCredentialSettings = Partial<
  Pick<GlobalSettings, 'agentDefaultEnv' | 'revioClaudeAuth' | 'revioCodexAuth'>
>

/**
 * The launch environment a chosen provider needs: Claude's API key or custom gateway token, or
 * Codex's OpenAI key. Read from the sealed store at launch, so the secrets never live in settings.
 */
export function agentCredentialEnv(
  agent: string,
  settings: AgentCredentialSettings,
  credentials: Credentials
): Record<string, string> {
  if (agent === 'claude') {
    const provider = claudeProviderFromSettings(settings)
    if (provider === 'apiKey' && credentials.anthropicApiKey) {
      return { ANTHROPIC_API_KEY: credentials.anthropicApiKey }
    }
    if (provider === 'custom' && credentials.anthropicAuthToken) {
      return { ANTHROPIC_AUTH_TOKEN: credentials.anthropicAuthToken }
    }
    return {}
  }
  if (agent === 'codex' && settings.revioCodexAuth === 'apiKey' && credentials.openaiApiKey) {
    return { OPENAI_API_KEY: credentials.openaiApiKey, CODEX_API_KEY: credentials.openaiApiKey }
  }
  return {}
}
