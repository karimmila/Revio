import { app } from 'electron'
import {
  cleanCloudServiceUrl as cleanUrl,
  cleanCloudServiceOrigin as cleanOrigin
} from '../../shared/cloud-service-url'
import { resolvePushGatewayOrigin } from '../runtime/push/push-gateway-origin'
import { FORK_IDENTITY, FORK_PRODUCT_NAME, type ForkServices } from '../../shared/fork-identity'
import { forkServiceUrl } from '../../shared/fork-services'

export type OrcaCloudAuthConfig = {
  apiBaseUrl: string
  authorizeEndpoint: string
  sessionEndpoint: string
  refreshEndpoint: string
  capabilitiesEndpoint: string
  profileEndpoint: string
  orgEndpoint: string
  logoutEndpoint: string
  relayTokenEndpoint: string
  connectorTokenEndpoint: string
  /** Null when this build has no relay: mobile pairing and remote access stay off. */
  relayDirectorUrl: string | null
  clientId: string
  scope: string
}

/** What the mobile relay needs: a sign-in config whose relay is on. */
export type OrcaRelayAuthConfig = OrcaCloudAuthConfig & { relayDirectorUrl: string }

const DEFAULT_SCOPE = 'openid profile email offline_access'
const PRODUCTION_CLIENT_ID = 'orca-desktop'

// Packaged main omits NODE_ENV; use packaged status to gate development auth overrides.
function isPackagedOrcaBuild(): boolean {
  try {
    return app?.isPackaged === true
  } catch {
    return false
  }
}

function endpoint(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString()
}

export function getOrcaCloudAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedOrcaBuild(),
  services: ForkServices = FORK_IDENTITY.services
): { configured: true; config: OrcaCloudAuthConfig } | { configured: false; setupMessage: string } {
  const notConfigured = {
    configured: false as const,
    setupMessage: `${FORK_PRODUCT_NAME} Cloud sign-in is not configured for this build.`
  }
  // Env overrides only redirect a service this fork runs; they never turn one on, so no shell
  // export can send an account to someone else's server.
  const forkLoginUrl = forkServiceUrl('cloudLoginUrl', services)
  if (!forkLoginUrl) {
    return notConfigured
  }
  // Plain HTTP token endpoints are development-only.
  const allowLoopbackHttp = !packaged
  const cleanEndpointUrl = (value: string | undefined): string | null =>
    cleanUrl(value, allowLoopbackHttp)
  const configuredApiBaseUrl = env.ORCA_CLOUD_API_URL?.trim()
  // Packaged builds need defaults; first-party endpoints and public client IDs are not secrets.
  const apiBaseUrl = configuredApiBaseUrl
    ? cleanEndpointUrl(configuredApiBaseUrl)
    : packaged
      ? cleanUrl(forkLoginUrl, false)
      : null
  const clientId = env.ORCA_CLOUD_CLIENT_ID?.trim() || (packaged ? PRODUCTION_CLIENT_ID : undefined)
  if (!apiBaseUrl || !clientId) {
    return notConfigured
  }

  const authBaseUrl = cleanEndpointUrl(env.ORCA_CLOUD_AUTH_URL) ?? apiBaseUrl
  return {
    configured: true,
    config: {
      apiBaseUrl,
      authorizeEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_AUTHORIZE_URL) ??
        endpoint(authBaseUrl, '/v1/desktop/auth/authorize'),
      sessionEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_SESSION_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/session'),
      refreshEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_REFRESH_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/refresh'),
      capabilitiesEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_CAPABILITIES_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/capabilities'),
      profileEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_PROFILE_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/profile'),
      orgEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_ORG_URL) ?? endpoint(apiBaseUrl, '/v1/desktop/auth/org'),
      logoutEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_LOGOUT_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/logout'),
      relayTokenEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_RELAY_TOKEN_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/relay-token'),
      connectorTokenEndpoint:
        cleanEndpointUrl(env.ORCA_CLOUD_CONNECTOR_TOKEN_URL) ??
        endpoint(apiBaseUrl, '/v1/desktop/auth/connector-token'),
      relayDirectorUrl: getOrcaRelayDirectorUrl(env, packaged, services),
      clientId,
      scope: env.ORCA_CLOUD_AUTH_SCOPE?.trim() || DEFAULT_SCOPE
    }
  }
}

/** Null when this build has no relay; ORCA_RELAY_URL may only redirect a relay that is on. */
export function getOrcaRelayDirectorUrl(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedOrcaBuild(),
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  const relay = forkServiceUrl('relayBaseUrl', services)
  if (!relay) {
    return null
  }
  return cleanOrigin(env.ORCA_RELAY_URL, !packaged) ?? cleanOrigin(relay, false)
}

/** Host-key authentication keeps phone push available without a signed-in account. */
export function getOrcaPushGatewayUrl(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedOrcaBuild()
): string | null {
  return resolvePushGatewayOrigin(env, packaged)
}

export function allowsPlaintextOrcaCloudSession(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedOrcaBuild()
): boolean {
  return (
    env.ORCA_CLOUD_ALLOW_PLAINTEXT_SESSION === '1' && env.NODE_ENV !== 'production' && !packaged
  )
}

export function isOrcaCloudDevAuthEnabled(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedOrcaBuild()
): boolean {
  return env.ORCA_CLOUD_DEV_AUTH === '1' && env.NODE_ENV !== 'production' && !packaged
}
