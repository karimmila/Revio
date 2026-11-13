import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginMarketplaceService } from './plugin-marketplace-service'
import { PluginMarketplaceStore } from './plugin-marketplace-store'
import { PluginKillListService } from './plugin-kill-list-service'
import { PluginInstallStatsService } from './plugin-install-stats-service'

const UPSTREAM_OFFICIAL = 'https://github.com/stablyai/orca-plugins.git'
const UPSTREAM_COMMUNITY = 'https://github.com/stablyai/orca-community-plugins.git'
const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-plugin-catalogs-off-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

// fork-identity.json names no catalog and no plugin directory, so nothing here may reach the network.
describe('plugin catalogs with no fork services', () => {
  it('seeds nothing and hides upstream catalogs a profile already stored', async () => {
    const root = await tempRoot()
    const store = new PluginMarketplaceStore(root)
    const upstream = await store.addSource({ kind: 'git', url: UPSTREAM_OFFICIAL, ref: 'main' })
    await store.addSource({ kind: 'git', url: UPSTREAM_COMMUNITY, ref: 'main' })
    const fetcher = vi.fn(async () => {
      throw new Error('offline')
    })
    const service = new PluginMarketplaceService({ pluginsDataDir: root, store, fetcher })

    await expect(service.seedOfficialSource()).resolves.toBeNull()
    await service.seedCommunitySource()
    expect(await service.listSources()).toEqual([])
    expect(await service.listPlugins()).toEqual([])
    await expect(service.refreshAll()).resolves.toEqual([])
    await expect(service.refreshSource(upstream.id)).rejects.toThrow(/unknown marketplace/)
    await expect(
      service.addSource({ kind: 'git', url: UPSTREAM_COMMUNITY, ref: 'main' })
    ).rejects.toThrow(/turned off/)

    expect(fetcher).not.toHaveBeenCalled()
    expect(await store.listSources()).toHaveLength(2)
  })

  it('never fetches the safety list or install counts', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const root = await tempRoot()
    const killList = new PluginKillListService({ pluginsDataDir: root })
    await expect(killList.refresh()).resolves.toMatchObject({ plugins: [] })
    killList.syncPeriodicRefresh(true)
    killList.dispose()

    const stats = new PluginInstallStatsService({
      pluginsDataDir: root,
      isFetchAllowed: () => true
    })
    await expect(stats.getInstallCounts()).resolves.toEqual({})
    await stats.settled()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
