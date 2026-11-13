/**
 * Secrets the workspace layout's provider settings keep sealed on this Mac; never sent to the
 * renderer.
 */
export type AgentCredentialName = 'anthropicApiKey' | 'anthropicAuthToken' | 'openaiApiKey'

export type AgentCredentialStatus = Record<AgentCredentialName, boolean>

export const AGENT_CREDENTIAL_NAMES: readonly AgentCredentialName[] = [
  'anthropicApiKey',
  'anthropicAuthToken',
  'openaiApiKey'
]
