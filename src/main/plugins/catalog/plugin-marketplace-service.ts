import {
  isOfficialMarketplaceGitSource,
  isMarketplaceListingSupported,
  isSameGitRepository,
  pluginMarketplaceGitSourceSchema,
  type PluginMarketplaceEntry,
  type PluginMarketplaceGitSource
} from '../../../shared/plugins/catalog/plugin-marketplace'
import {
  fetchPluginMarketplace,
  type PluginMarketplaceFetchResult
} from './plugin-marketplace-fetch'
import {
  marketplaceSourceId,
  PluginMarketplaceStore,
  type PluginMarketplaceCachedSnapshot,
  type PluginMarketplaceRegisteredSource
} from './plugin-marketplace-store'
import type { PluginKillListEntry } from '../../../shared/plugins/catalog/plugin-kill-list'
import type { PluginImageCache } from '../plugin-image-cache'
import { validateMarketplaceProvenance } from './plugin-marketplace-provenance'
import { CommunityMarketplaceSeed } from './plugin-community-marketplace-seed'
import { pluginMarketplaceErrorMessage } from './plugin-marketplace-error-message'
import { sourceStateFromSnapshot } from './plugin-marketplace-source-state'
import {
  pluginMarketplaceListing,
  type PluginMarketplaceListing,
  type PluginMarketplaceSourceState
} from './plugin-marketplace-projection'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'
import {
  isDisabledDefaultCatalogUrl,
  officialCatalogSource
} from '../../../shared/plugins/catalog/plugin-default-catalogs'
export type {
  PluginMarketplaceListing,
  PluginMarketplaceSourceState
} from './plugin-marketplace-projection'

type MarketplaceFetcher = (
  source: PluginMarketplaceRegisteredSource
) => Promise<PluginMarketplaceFetchResult>

export class PluginMarketplaceService {
  private readonly store: PluginMarketplaceStore
  private readonly fetcher: MarketplaceFetcher
  private readonly getKillListEntry: (pluginKey: string) => PluginKillListEntry | null
  private readonly hostVersion: string | null
  private readonly imageCache: PluginImageCache | null
  private readonly refreshChains = new Map<string, Promise<PluginMarketplaceSourceState>>()
  private readonly sourceErrors = new Map<string, string>()
  private officialSeedPromise: Promise<PluginMarketplaceSourceState | null> | null = null
  private officialSeedRequested = false
  private readonly communitySeed: CommunityMarketplaceSeed

  constructor(options: {
    pluginsDataDir: string
    fetcher?: MarketplaceFetcher
    store?: PluginMarketplaceStore
    getKillListEntry?: (pluginKey: string) => PluginKillListEntry | null
    /** Picks which of an entry's releases to offer; without it the newest is offered. */
    hostVersion?: string
    imageCache?: PluginImageCache
  }) {
    this.hostVersion = options.hostVersion ?? null
    this.imageCache = options.imageCache ?? null
    this.store = options.store ?? new PluginMarketplaceStore(options.pluginsDataDir)
    this.fetcher = options.fetcher ?? fetchPluginMarketplace
    this.getKillListEntry = options.getKillListEntry ?? (() => null)
    this.communitySeed = new CommunityMarketplaceSeed(this.store, (source) =>
      this.addSource(source)
    )
  }

  async listSources(): Promise<PluginMarketplaceSourceState[]> {
    await this.waitForOfficialSeed()
    const sources = await this.visibleSources()
    return Promise.all(
      sources.map(async (source) => {
        try {
          const error = this.sourceErrors.get(source.id)
          return sourceStateFromSnapshot(
            source,
            await this.store.readSnapshot(source.id),
            Boolean(error),
            error
          )
        } catch (error) {
          return sourceStateFromSnapshot(source, null, true, pluginMarketplaceErrorMessage(error))
        }
      })
    )
  }

  async addSource(source: PluginMarketplaceGitSource): Promise<PluginMarketplaceSourceState> {
    const parsedSource = pluginMarketplaceGitSourceSchema.parse(source)
    if (isDisabledDefaultCatalogUrl(parsedSource.url)) {
      throw new Error(`this catalog is turned off in this ${FORK_PRODUCT_NAME} build`)
    }
    const sourceId = marketplaceSourceId(parsedSource)
    const existing = (await this.store.listSources()).find((candidate) => candidate.id === sourceId)
    const candidate: PluginMarketplaceRegisteredSource = existing ?? {
      id: sourceId,
      source: parsedSource,
      addedAt: Date.now()
    }
    const fetched = await this.fetchAndValidate(candidate)
    const registered = existing ?? (await this.store.addSource(parsedSource, candidate.addedAt))
    try {
      const snapshot = await this.store.writeSnapshot({ source: registered, ...fetched })
      this.sourceErrors.delete(registered.id)
      return sourceStateFromSnapshot(registered, snapshot, false)
    } catch (error) {
      if (!existing) {
        await this.store.removeSource(registered.id).catch(() => undefined)
      }
      throw error
    }
  }

  async removeSource(sourceId: string): Promise<boolean> {
    const source = (await this.store.listSources()).find((candidate) => candidate.id === sourceId)
    if (source && isOfficialMarketplaceGitSource(source.source.url)) {
      throw new Error(
        `the official marketplace is managed by ${FORK_PRODUCT_NAME} and cannot be removed`
      )
    }
    const removed = await this.store.removeSource(sourceId)
    if (removed) {
      this.sourceErrors.delete(sourceId)
      if (this.officialSeedRequested) {
        // Recover the managed source when a full profile frees a slot, without restart.
        await this.seedOfficialSource().catch(() => undefined)
      }
    }
    return removed
  }

  /** null when this build names no official catalog: nothing is added or fetched. */
  seedOfficialSource(): Promise<PluginMarketplaceSourceState | null> {
    this.officialSeedRequested = true
    if (!this.officialSeedPromise) {
      const seed = this.performOfficialSeed()
      this.officialSeedPromise = seed
      void seed.catch(() => {
        if (this.officialSeedPromise === seed) {
          // Store/full-list failures must permit later seeding attempts.
          this.officialSeedPromise = null
        }
      })
    }
    return this.officialSeedPromise
  }

  /** Adds the community catalog once by default; see CommunityMarketplaceSeed. */
  seedCommunitySource(now?: number): Promise<void> {
    return this.communitySeed.run(now)
  }

  async refreshSource(sourceId: string): Promise<PluginMarketplaceSourceState> {
    const previous = this.refreshChains.get(sourceId) ?? Promise.resolve(null)
    const refresh = previous.catch(() => null).then(() => this.performRefresh(sourceId))
    this.refreshChains.set(sourceId, refresh)
    try {
      return await refresh
    } finally {
      if (this.refreshChains.get(sourceId) === refresh) {
        this.refreshChains.delete(sourceId)
      }
    }
  }

  async refreshAll(): Promise<PluginMarketplaceSourceState[]> {
    await this.waitForOfficialSeed()
    const sources = await this.visibleSources()
    return Promise.all(sources.map((source) => this.refreshSource(source.id)))
  }

  async listPlugins(): Promise<PluginMarketplaceListing[]> {
    await this.waitForOfficialSeed()
    return (await this.listCachedPlugins()).sort((left, right) =>
      `${left.pluginKey}\0${left.marketplaceSourceId}`.localeCompare(
        `${right.pluginKey}\0${right.marketplaceSourceId}`
      )
    )
  }

  /** Listings from the cached catalogs in catalog order, without waiting on any fetch. */
  async listCachedPlugins(): Promise<PluginMarketplaceListing[]> {
    const states = await this.listSnapshots()
    return states.flatMap(({ source, snapshot }) =>
      snapshot.marketplace.plugins
        // Why: hide packs whose contribution kind this build no longer
        // supports (themes/icons/skills) so users never reach a dead install.
        .filter((entry) => isMarketplaceListingSupported(entry.categories))
        .map((entry) => this.listingFromEntry(source, snapshot, entry))
    )
  }

  async findPlugin(
    marketplaceSourceId: string,
    pluginKey: string
  ): Promise<PluginMarketplaceListing | null> {
    const source = (await this.visibleSources()).find(
      (candidate) => candidate.id === marketplaceSourceId
    )
    if (!source) {
      return null
    }
    const snapshot = await this.store.readSnapshot(source.id)
    // Preview/install key lookups must reject unsupported packs too.
    const entry = snapshot?.marketplace.plugins.find(
      (plugin) => plugin.id === pluginKey && isMarketplaceListingSupported(plugin.categories)
    )
    return snapshot && entry ? this.listingFromEntry(source, snapshot, entry) : null
  }

  private async performRefresh(sourceId: string): Promise<PluginMarketplaceSourceState> {
    const source = (await this.visibleSources()).find((candidate) => candidate.id === sourceId)
    if (!source) {
      throw new Error(`unknown marketplace source: ${sourceId}`)
    }
    try {
      const fetched = await this.fetchAndValidate(source)
      const snapshot = await this.store.writeSnapshot({ source, ...fetched })
      this.sourceErrors.delete(source.id)
      return sourceStateFromSnapshot(source, snapshot, false)
    } catch (error) {
      const cached = await this.store.readSnapshot(source.id).catch(() => null)
      if (!cached) {
        throw error
      }
      const message = pluginMarketplaceErrorMessage(error)
      this.sourceErrors.set(source.id, message)
      return sourceStateFromSnapshot(source, cached, true, message)
    }
  }

  private async performOfficialSeed(): Promise<PluginMarketplaceSourceState | null> {
    const official = officialCatalogSource()
    if (!official) {
      return null
    }
    const sources = await this.visibleSources()
    const existing = sources.find((source) => isSameGitRepository(source.source.url, official.url))
    const source = existing ?? (await this.store.addSource(official, Date.now()))
    const snapshot = await this.store.readSnapshot(source.id).catch(() => null)
    if (snapshot) {
      return sourceStateFromSnapshot(source, snapshot, false)
    }
    try {
      return await this.performRefresh(source.id)
    } catch (error) {
      // Keep official source configuration offline so later refreshes need no user-supplied URL.
      const message = pluginMarketplaceErrorMessage(error)
      this.sourceErrors.set(source.id, message)
      return sourceStateFromSnapshot(source, null, true, message)
    }
  }

  // Upstream default catalogs this build turned off stay in the store but are never read or fetched.
  private async visibleSources(): Promise<PluginMarketplaceRegisteredSource[]> {
    return (await this.store.listSources()).filter(
      (source) => !isDisabledDefaultCatalogUrl(source.source.url)
    )
  }

  private async waitForOfficialSeed(): Promise<void> {
    await this.officialSeedPromise?.catch(() => undefined)
    await this.communitySeed.settled()
  }

  private async fetchAndValidate(
    source: PluginMarketplaceRegisteredSource
  ): Promise<PluginMarketplaceFetchResult> {
    const fetched = await this.fetcher(source)
    validateMarketplaceProvenance(source, fetched)
    const cache = this.imageCache
    if (cache) {
      await Promise.all(
        (fetched.images ?? []).map((image) =>
          cache.put(image).catch((error: unknown) => {
            console.warn('[plugins] could not cache marketplace image:', error)
            return null
          })
        )
      )
    }
    return fetched
  }

  private async listSnapshots(): Promise<
    { source: PluginMarketplaceRegisteredSource; snapshot: PluginMarketplaceCachedSnapshot }[]
  > {
    const sources = await this.visibleSources()
    const snapshots = await Promise.all(
      sources.map(async (source) => ({
        source,
        snapshot: await this.store.readSnapshot(source.id)
      }))
    )
    return snapshots.filter(
      (
        candidate
      ): candidate is {
        source: PluginMarketplaceRegisteredSource
        snapshot: PluginMarketplaceCachedSnapshot
      } => candidate.snapshot !== null
    )
  }

  private listingFromEntry(
    source: PluginMarketplaceRegisteredSource,
    snapshot: PluginMarketplaceCachedSnapshot,
    entry: PluginMarketplaceEntry
  ): PluginMarketplaceListing {
    return pluginMarketplaceListing({
      source,
      snapshot,
      entry,
      hostVersion: this.hostVersion,
      blocked: this.getKillListEntry(entry.id)
    })
  }
}
