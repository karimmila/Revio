import { beforeEach, describe, expect, it, vi } from 'vitest'

const setup = vi.hoisted(() => ({
  setupAutoUpdater: vi.fn(),
  checkForUpdates: vi.fn(),
  checkForUpdatesFromMenu: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  listAvailableReleaseBuilds: vi.fn(async () => [{ tag: 'v9.9.9' }]),
  checkForRemoteServerUpdate: vi.fn(),
  downloadRemoteServerUpdate: vi.fn(),
  installRemoteServerUpdate: vi.fn(),
  getRemoteServerUpdaterSnapshot: vi.fn(() => ({ runtimeId: 'r1' }))
}))

vi.mock('../../shared/update-feed', () => ({ isAppUpdaterEnabled: () => false }))
vi.mock('./lifecycle/updater-setup', () => ({
  UpdaterSetup: class {
    setupAutoUpdater = setup.setupAutoUpdater
    checkForUpdates = setup.checkForUpdates
    checkForUpdatesFromMenu = setup.checkForUpdatesFromMenu
    downloadUpdate = setup.downloadUpdate
    quitAndInstall = setup.quitAndInstall
    listAvailableReleaseBuilds = setup.listAvailableReleaseBuilds
    checkForRemoteServerUpdate = setup.checkForRemoteServerUpdate
    downloadRemoteServerUpdate = setup.downloadRemoteServerUpdate
    installRemoteServerUpdate = setup.installRemoteServerUpdate
    getRemoteServerUpdaterSnapshot = setup.getRemoteServerUpdaterSnapshot
  }
}))

const service = await import('./updater-service')

describe('updater service without an update feed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('never sets up, checks, downloads or installs', async () => {
    service.setupAutoUpdater(null)
    service.checkForUpdates()
    service.checkForUpdatesFromMenu({ includePrerelease: true })
    service.downloadUpdate()
    service.quitAndInstall()

    expect(setup.setupAutoUpdater).not.toHaveBeenCalled()
    expect(setup.checkForUpdates).not.toHaveBeenCalled()
    expect(setup.checkForUpdatesFromMenu).not.toHaveBeenCalled()
    expect(setup.downloadUpdate).not.toHaveBeenCalled()
    expect(setup.quitAndInstall).not.toHaveBeenCalled()
    await expect(service.listAvailableReleaseBuilds('stable')).resolves.toEqual([])
    expect(setup.listAvailableReleaseBuilds).not.toHaveBeenCalled()
  })

  it('reports remote servers as manual and refuses remote installs', () => {
    expect(service.checkForRemoteServerUpdate('r1')).toEqual({ runtimeId: 'r1' })
    expect(service.downloadRemoteServerUpdate('r1')).toEqual({ runtimeId: 'r1' })
    expect(() => service.installRemoteServerUpdate('r1')).toThrow('remote_update_manual_required')
    expect(setup.checkForRemoteServerUpdate).not.toHaveBeenCalled()
    expect(setup.downloadRemoteServerUpdate).not.toHaveBeenCalled()
    expect(setup.installRemoteServerUpdate).not.toHaveBeenCalled()
  })
})
