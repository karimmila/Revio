import { CLOUD_SANDBOX_ENV } from '../../../shared/cloud/cloud-sandbox-host'
import { CLAUDE_PLACEHOLDER_TOKEN } from '../../../shared/cloud/cloud-claude-placeholder'
import { cloudSandboxChatPermissionSettings } from '../../../shared/cloud/cloud-sandbox-chat-permission'

/** Sandboxes made before the marker existed are known by their Claude stand-in token. */
export function isCloudSandboxHost(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CLOUD_SANDBOX_ENV] === '1' || env.CLAUDE_CODE_OAUTH_TOKEN === CLAUDE_PLACEHOLDER_TOKEN
}

/** The settings a new chat's permission comes from on this host: lifted inside a cloud sandbox. */
export function newChatPermissionSettingsForHost<
  T extends Parameters<typeof cloudSandboxChatPermissionSettings>[0]
>(settings: T, env: NodeJS.ProcessEnv = process.env): T {
  return isCloudSandboxHost(env) ? cloudSandboxChatPermissionSettings(settings) : settings
}
