import type {
  PluginMarketplaceHostListing,
  PluginMarketplaceHostSourceState
} from '../../../../../preload/api-types'
import {
  isCommunityCatalogUrl,
  isOfficialCatalogUrl
} from '../../../../../shared/plugins/catalog/plugin-default-catalogs'

/** The listing comes from Orca's official or community catalog, whose plugins have public stats. */
export function isPublicCatalogListing(
  listing: PluginMarketplaceHostListing | null,
  catalogById: ReadonlyMap<string, PluginMarketplaceHostSourceState>
): boolean {
  if (!listing) {
    return false
  }
  const url = catalogById.get(listing.marketplaceSourceId)?.source.url
  return Boolean(url && (isOfficialCatalogUrl(url) || isCommunityCatalogUrl(url)))
}
