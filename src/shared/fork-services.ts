import { FORK_IDENTITY, type ForkServices } from './fork-identity'

export type ForkServiceName = Exclude<keyof ForkServices, 'telemetryWriteKey'>

/*
 * The one reader of fork-identity.json `services`. Revio must never send user data to a third
 * party, so a service is on only when this fork names its own endpoint there. Callers treat null
 * as "feature off": no request, and no UI entry point. src/shared/fork-services-host-scan.test.ts
 * fails when an upstream hostname shows up in runtime code again (for example after a merge).
 */
export function forkServiceUrl(
  name: ForkServiceName,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  return cleanHttpsUrl(services[name])
}

export function isForkServiceEnabled(
  name: ForkServiceName,
  services: ForkServices = FORK_IDENTITY.services
): boolean {
  return forkServiceUrl(name, services) !== null
}

/** Resolves a docs path such as `/docs/terminal#admin` against docsBaseUrl; null hides the link. */
export function forkDocsUrl(
  path: string,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  return forkServiceEndpoint('docsBaseUrl', path, services)
}

/** Joins a path onto a service origin; null when the service is off. */
export function forkServiceEndpoint(
  name: ForkServiceName,
  path: string,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  const base = forkServiceUrl(name, services)
  if (!base) {
    return null
  }
  return new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`).toString()
}

export function forkTelemetryWriteKey(
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  const key = services.telemetryWriteKey?.trim()
  return key ? key : null
}

function cleanHttpsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}
