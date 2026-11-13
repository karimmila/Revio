import { forkServiceUrl } from '../../fork-services'
import {
  isOfficialMarketplaceGitSource,
  isSameGitRepository,
  OFFICIAL_MARKETPLACE_OWNER,
  parseGitRepositoryIdentity,
  type PluginMarketplaceGitSource
} from './plugin-marketplace'

/*
 * The official and community catalogs come only from fork-identity.json `services`. Both ship
 * null, so this build adds, lists and fetches neither; catalogs a profile stored from an upstream
 * build (it shares the user-data folder in dev) are hidden instead of refreshed.
 */
const UPSTREAM_COMMUNITY_REPOSITORY = 'orca-community-plugins'

function catalogSource(url: string | null): PluginMarketplaceGitSource | null {
  return url ? { kind: 'git', url, ref: 'main' } : null
}

export function officialCatalogSource(): PluginMarketplaceGitSource | null {
  return catalogSource(forkServiceUrl('pluginCatalogUrl'))
}

export function communityCatalogSource(): PluginMarketplaceGitSource | null {
  return catalogSource(forkServiceUrl('communityPluginCatalogUrl'))
}

export function isAnyDefaultCatalogEnabled(): boolean {
  return officialCatalogSource() !== null || communityCatalogSource() !== null
}

function isUpstreamCommunityCatalogUrl(url: string): boolean {
  const source = parseGitRepositoryIdentity(url)
  return (
    source?.host === 'github.com' &&
    source.owner.toLowerCase() === OFFICIAL_MARKETPLACE_OWNER &&
    source.repository.toLowerCase() === UPSTREAM_COMMUNITY_REPOSITORY
  )
}

function matches(url: string, source: PluginMarketplaceGitSource | null): boolean {
  return source !== null && isSameGitRepository(url, source.url)
}

/** The configured official catalog, or upstream's own; labels and stats only, never a fetch. */
export function isOfficialCatalogUrl(url: string): boolean {
  return matches(url, officialCatalogSource()) || isOfficialMarketplaceGitSource(url)
}

/** The configured community catalog, or upstream's own; labels and stats only, never a fetch. */
export function isCommunityCatalogUrl(url: string): boolean {
  return matches(url, communityCatalogSource()) || isUpstreamCommunityCatalogUrl(url)
}

/** An upstream default catalog this build did not name: never listed, refreshed or added. */
export function isDisabledDefaultCatalogUrl(url: string): boolean {
  if (isOfficialMarketplaceGitSource(url)) {
    return !matches(url, officialCatalogSource())
  }
  if (isUpstreamCommunityCatalogUrl(url)) {
    return !matches(url, communityCatalogSource())
  }
  return false
}
