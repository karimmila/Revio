import { cleanCloudServiceOrigin } from '../../shared/cloud-service-url'
import { FORK_IDENTITY, type ForkServices } from '../../shared/fork-identity'
import { forkServiceUrl } from '../../shared/fork-services'

/** Null when this build has no connector service; ORCA_CONNECTOR_URL only redirects one that is on. */
export function resolveConnectorOrigin(
  env: NodeJS.ProcessEnv,
  packaged: boolean,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  const connector = forkServiceUrl('connectorUrl', services)
  if (!connector) {
    return null
  }
  return (
    cleanCloudServiceOrigin(env.ORCA_CONNECTOR_URL, !packaged) ??
    cleanCloudServiceOrigin(connector, false)
  )
}
