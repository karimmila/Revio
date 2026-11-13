import type { ProviderRateLimits } from './rate-limit-types'

export type UsageMeterProvider = ProviderRateLimits['provider']

const PROVIDER_BY_AGENT: Partial<Record<string, UsageMeterProvider>> = {
  claude: 'claude',
  'claude-agent-teams': 'claude',
  codex: 'codex',
  gemini: 'gemini',
  antigravity: 'antigravity',
  opencode: 'opencode-go',
  opencode2: 'opencode-go',
  kimi: 'kimi',
  grok: 'grok',
  cursor: 'cursor',
  zcode: 'zcode'
}

/** The usage meter that belongs to an agent; null for an agent without one. */
export function usageMeterProviderForAgent(
  agentType: string | undefined
): UsageMeterProvider | null {
  return (agentType && PROVIDER_BY_AGENT[agentType]) || null
}

/**
 * Whether a provider's ambient credentials (another tool's login on this computer) may be read:
 * an agent of that provider has run in this app, or the person added an account for it here.
 * MiniMax and Gemini read only what was saved or switched on in Settings, so they are always on.
 */
export function isUsageMeterProviderEnabled(
  provider: UsageMeterProvider,
  evidence: {
    usedProviders: readonly string[]
    claudeManagedAccounts: number
    codexManagedAccounts: number
  }
): boolean {
  if (provider === 'minimax' || provider === 'gemini') {
    return true
  }
  if (evidence.usedProviders.includes(provider)) {
    return true
  }
  if (provider === 'claude') {
    return evidence.claudeManagedAccounts > 0
  }
  if (provider === 'codex') {
    return evidence.codexManagedAccounts > 0
  }
  return false
}
