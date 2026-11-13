import { isOfficialMarketplaceGitSource } from '../../../shared/plugins/catalog/plugin-marketplace'
import type {
  PluginMarketplaceCachedSnapshot,
  PluginMarketplaceRegisteredSource
} from './plugin-marketplace-store'
import type { PluginMarketplaceSourceState } from './plugin-marketplace-projection'

export function sourceStateFromSnapshot(
  source: PluginMarketplaceRegisteredSource,
  snapshot: PluginMarketplaceCachedSnapshot | null,
  stale: boolean,
  error?: string
): PluginMarketplaceSourceState {
  return {
    id: source.id,
    source: source.source,
    addedAt: source.addedAt,
    marketplace: snapshot
      ? {
          name: snapshot.marketplace.name,
          owner: snapshot.marketplace.owner,
          resolvedCommit: snapshot.marketplaceCommit,
          fetchedAt: snapshot.fetchedAt
        }
      : null,
    stale,
    official: isOfficialMarketplaceGitSource(source.source.url),
    ...(error ? { error } : {})
  }
}
