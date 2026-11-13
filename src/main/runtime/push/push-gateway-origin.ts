import { cleanCloudServiceOrigin } from '../../../shared/cloud-service-url'
import { FORK_IDENTITY, type ForkServices } from '../../../shared/fork-identity'
import { forkServiceUrl } from '../../../shared/fork-services'

/** Null when this build has no push gateway; ORCA_PUSH_GATEWAY_URL only redirects one that is on. */
export function resolvePushGatewayOrigin(
  env: NodeJS.ProcessEnv,
  packaged: boolean,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  const gateway = forkServiceUrl('pushGatewayUrl', services)
  if (!gateway) {
    return null
  }
  return (
    cleanCloudServiceOrigin(env.ORCA_PUSH_GATEWAY_URL, !packaged) ??
    cleanCloudServiceOrigin(gateway, false)
  )
}
