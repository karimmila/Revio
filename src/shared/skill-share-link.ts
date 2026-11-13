import { FORK_IDENTITY, isAppLinkProtocol, isAppLinkText, type ForkServices } from './fork-identity'
import { forkServiceUrl } from './fork-services'
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function shareLinkHosts(services: ForkServices): Set<string> {
  const hosts = new Set<string>()
  for (const url of [
    forkServiceUrl('skillShareUrl', services),
    forkServiceUrl('shareBaseUrl', services)
  ]) {
    if (url) {
      hosts.add(new URL(url).hostname)
    }
  }
  return hosts
}

/** Null whenever this build has no share service, so no link can start a share download. */
export function parseSkillShareId(
  value: string,
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  if (!forkServiceUrl('shareBaseUrl', services)) {
    return null
  }
  const trimmed = value.trim()
  if (SHARE_ID_PATTERN.test(trimmed)) {
    return trimmed
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (isAppLinkProtocol(url.protocol)) {
    const match = `${url.host}${url.pathname}`.match(/^skills\/share\/([A-Za-z0-9_-]{1,128})\/?$/)
    return match?.[1] ?? null
  }
  const developmentHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(developmentHost && url.protocol === 'http:')) {
    return null
  }
  if (!shareLinkHosts(services).has(url.hostname) && !developmentHost) {
    return null
  }
  const match = url.pathname.match(/^\/skills\/share\/([A-Za-z0-9_-]{1,128})\/?$/)
  return match?.[1] ?? null
}

export function skillShareIdFromArguments(
  argv: readonly string[],
  services: ForkServices = FORK_IDENTITY.services
): string | null {
  for (const value of argv) {
    const id = parseSkillShareId(value, services)
    if (id && (value.includes('/skills/share/') || isAppLinkText(value))) {
      return id
    }
  }
  return null
}
