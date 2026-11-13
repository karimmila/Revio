import { app } from 'electron'
import { FORK_IDENTITY, type ForkServices } from '../../shared/fork-identity'
import { forkServiceUrl } from '../../shared/fork-services'

export const ARTIFACT_SHARING_OFF_MESSAGE = 'Sharing is not available in this build.'

function isPackaged(): boolean {
  try {
    return app?.isPackaged === true
  } catch {
    return false
  }
}

export function isArtifactCloudEnabled(services: ForkServices = FORK_IDENTITY.services): boolean {
  return forkServiceUrl('shareBaseUrl', services) !== null
}

/**
 * Throws before any request when this build has no share service; overrides only redirect a
 * share service the fork runs, so an env var or CLI flag cannot send a token elsewhere.
 */
export function resolveArtifactCloudApiUrl(
  override?: string,
  env: NodeJS.ProcessEnv = process.env,
  packaged = isPackaged(),
  services: ForkServices = FORK_IDENTITY.services
): string {
  const shareBaseUrl = forkServiceUrl('shareBaseUrl', services)
  if (!shareBaseUrl) {
    throw new Error(ARTIFACT_SHARING_OFF_MESSAGE)
  }
  const firstPartyHost = new URL(shareBaseUrl).hostname
  const candidate = override?.trim() || env.ORCA_ARTIFACTS_API_URL?.trim()
  const url = new URL(candidate || shareBaseUrl)
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  const firstParty = url.hostname === firstPartyHost
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && !packaged)) {
    throw new Error('Artifact API URLs must use HTTPS; local development may use loopback HTTP.')
  }
  if (!firstParty && !loopback) {
    throw new Error(`Artifact API URLs must use ${firstPartyHost} or a loopback host.`)
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Artifact API URL must be an origin without credentials, paths, or parameters.')
  }
  return url.origin
}

export function allowsArtifactCloudAuthOverride(
  env: NodeJS.ProcessEnv = process.env,
  packaged = isPackaged()
): boolean {
  return env.NODE_ENV !== 'production' && !packaged
}
