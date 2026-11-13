import { afterEach, beforeEach } from 'vitest'
import { FORK_IDENTITY, type ForkServices } from './fork-identity'

/**
 * Upstream's hosted endpoints, so suites that exercise the cloud code paths (which this fork
 * ships switched off) keep testing them. Nothing here reaches a real host: suites stub fetch.
 */
export const UPSTREAM_CLOUD_SERVICES: Partial<ForkServices> = {
  cloudLoginUrl: 'https://login.onorca.dev',
  relayBaseUrl: 'https://relay.onorca.dev',
  pushGatewayUrl: 'https://push.onorca.dev',
  connectorUrl: 'https://connector.onorca.dev',
  shareBaseUrl: 'https://share.onorca.dev',
  skillShareUrl: 'https://app.orca.dev'
}

/** Turns the given services on for every test in the calling file, then restores them. */
export function enableForkServicesForSuite(
  overrides: Partial<ForkServices> = UPSTREAM_CLOUD_SERVICES
): void {
  let saved: ForkServices | null = null
  beforeEach(() => {
    saved = { ...FORK_IDENTITY.services }
    Object.assign(FORK_IDENTITY.services, overrides)
  })
  afterEach(() => {
    if (saved) {
      Object.assign(FORK_IDENTITY.services, saved)
    }
  })
}
