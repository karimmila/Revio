/**
 * The login a Claude launch on this Mac uses, in order of preference:
 * - `managed`: a Claude account signed in through the app.
 * - `apiKey`: an Anthropic API key or token in the environment, or a provider picked in Settings
 *   (API key, gateway, Bedrock, Vertex AI).
 * - `system`: Claude Code's own login (`claude` run in a terminal and logged in).
 * - `none`: nothing usable, so the person must sign in first.
 */
export type ClaudeLoginRoute = 'managed' | 'apiKey' | 'system' | 'none'

export type ClaudeLoginFacts = {
  managedAccount: boolean
  /** A provider other than the Claude subscription is picked in Settings. */
  provider: boolean
  apiKey: boolean
  systemLogin: boolean
}

export function chooseClaudeLoginRoute(facts: ClaudeLoginFacts): ClaudeLoginRoute {
  if (facts.managedAccount) {
    return 'managed'
  }
  // Claude Code itself prefers an API key in the environment over its stored login.
  if (facts.provider || facts.apiKey) {
    return 'apiKey'
  }
  return facts.systemLogin ? 'system' : 'none'
}
