import type { GlobalSettings } from './global-settings-types'

/**
 * The Claude Code provider choice. Bedrock and Vertex are the launch environment flags
 * Claude Code reads (CLAUDE_CODE_USE_BEDROCK / _VERTEX) with the person's own cloud credentials;
 * API key and custom gateway use secrets kept in Orca's sealed credential store.
 */
export type ClaudeProvider = 'subscription' | 'apiKey' | 'bedrock' | 'vertex' | 'custom'

const PROVIDER_ENV = {
  bedrock: 'CLAUDE_CODE_USE_BEDROCK',
  vertex: 'CLAUDE_CODE_USE_VERTEX'
} as const

function on(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'
}

export function claudeProviderFromEnv(env: Record<string, string> | undefined): ClaudeProvider {
  if (on(env?.[PROVIDER_ENV.bedrock])) {
    return 'bedrock'
  }
  if (on(env?.[PROVIDER_ENV.vertex])) {
    return 'vertex'
  }
  return 'subscription'
}

export function claudeProviderFromSettings(
  settings: Partial<Pick<GlobalSettings, 'agentDefaultEnv' | 'revioClaudeAuth'>>
): ClaudeProvider {
  const fromEnv = claudeProviderFromEnv(settings.agentDefaultEnv?.claude)
  return fromEnv === 'subscription' && settings.revioClaudeAuth ? settings.revioClaudeAuth : fromEnv
}

export function withClaudeProvider(
  env: Record<string, string> | undefined,
  provider: ClaudeProvider
): Record<string, string> {
  const next = { ...env }
  delete next[PROVIDER_ENV.bedrock]
  delete next[PROVIDER_ENV.vertex]
  if (provider === 'bedrock' || provider === 'vertex') {
    next[PROVIDER_ENV[provider]] = '1'
  }
  return next
}

/** The settings writes that pick a provider: the env flag plus the secret-backed auth mode. */
export function claudeProviderUpdate(
  settings: Partial<Pick<GlobalSettings, 'agentDefaultEnv'>>,
  provider: ClaudeProvider
): Pick<GlobalSettings, 'agentDefaultEnv' | 'revioClaudeAuth'> {
  return {
    agentDefaultEnv: {
      ...settings.agentDefaultEnv,
      claude: withClaudeProvider(settings.agentDefaultEnv?.claude, provider)
    },
    revioClaudeAuth: provider === 'apiKey' || provider === 'custom' ? provider : undefined
  }
}
