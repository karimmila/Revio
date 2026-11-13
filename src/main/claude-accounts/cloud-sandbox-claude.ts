import { CLAUDE_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-claude-placeholder'

/**
 * An Orca cloud sandbox: Claude there reaches Anthropic through Orca's firewall broker, which
 * swaps the placeholder token for the one saved in Settings > Cloud. That host login is Orca's
 * own, so the rule "Claude only through an Orca account" does not apply to it.
 */
export function isOrcaCloudSandboxHost(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLAUDE_CODE_OAUTH_TOKEN === CLAUDE_PLACEHOLDER_TOKEN
}
