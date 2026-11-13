import type { BrowserWindow } from 'electron'
import type {
  LinuxPackageInstallInstructions,
  UpdateCheckOptions,
  UpdateStatus
} from '../../shared/update-status-types'
import type {
  RemoteServerUpdateInstallResult,
  RemoteServerUpdaterSnapshot,
  RemoteServerUpdateSupport
} from '../../shared/remote-server-update'
import type { ReleaseBuild, ReleaseChannel } from '../../shared/release-channel'
import type { ReleaseBuildListOptions } from './releases/updater-release-build-cache'
import { UpdaterSetup, type UpdaterSetupOptions } from './lifecycle/updater-setup'
import type { UpdateInstallMode } from './lifecycle/updater-state'
import { isAppUpdaterEnabled } from '../../shared/update-feed'

const updater = new UpdaterSetup()

// Every entry point that could reach the network or install a build passes through this gate,
// so a build without its own feed never fetches, downloads or installs (see update-feed.ts).

export function resolveUpdateInstallMode(isServeMode: boolean): UpdateInstallMode {
  return updater.resolveUpdateInstallMode(isServeMode)
}

export function getUpdateStatus(): UpdateStatus {
  return updater.getUpdateStatus()
}

export function getRemoteServerUpdateSupport(): RemoteServerUpdateSupport {
  return updater.getRemoteServerUpdateSupport()
}

export function getRemoteServerUpdaterSnapshot(runtimeId: string): RemoteServerUpdaterSnapshot {
  return updater.getRemoteServerUpdaterSnapshot(runtimeId)
}

export function checkForRemoteServerUpdate(
  runtimeId: string,
  options?: UpdateCheckOptions
): RemoteServerUpdaterSnapshot {
  if (!isAppUpdaterEnabled()) {
    return updater.getRemoteServerUpdaterSnapshot(runtimeId)
  }
  return updater.checkForRemoteServerUpdate(runtimeId, options)
}

export function downloadRemoteServerUpdate(runtimeId: string): RemoteServerUpdaterSnapshot {
  if (!isAppUpdaterEnabled()) {
    return updater.getRemoteServerUpdaterSnapshot(runtimeId)
  }
  return updater.downloadRemoteServerUpdate(runtimeId)
}

export function installRemoteServerUpdate(runtimeId: string): RemoteServerUpdateInstallResult {
  if (!isAppUpdaterEnabled()) {
    throw new Error('remote_update_manual_required')
  }
  return updater.installRemoteServerUpdate(runtimeId)
}

export function checkForUpdates(): void {
  if (isAppUpdaterEnabled()) {
    updater.checkForUpdates()
  }
}

export function checkForUpdatesFromMenu(options?: UpdateCheckOptions): void {
  if (isAppUpdaterEnabled()) {
    updater.checkForUpdatesFromMenu(options)
  }
}

export function downloadUpdate(): void {
  if (isAppUpdaterEnabled()) {
    updater.downloadUpdate()
  }
}

export function quitAndInstall(): void {
  if (isAppUpdaterEnabled()) {
    updater.quitAndInstall()
  }
}

export function isQuittingForUpdate(): boolean {
  return updater.isQuittingForUpdate()
}

export async function getLinuxPackageInstallInstructions(): Promise<LinuxPackageInstallInstructions> {
  return updater.getLinuxPackageInstallInstructions()
}

export async function showLinuxPackage(): Promise<void> {
  return updater.showLinuxPackage()
}

export async function listAvailableReleaseBuilds(
  channel: ReleaseChannel,
  options?: ReleaseBuildListOptions
): Promise<ReleaseBuild[]> {
  if (!isAppUpdaterEnabled()) {
    return []
  }
  return updater.listAvailableReleaseBuilds(channel, options)
}

export function dismissNudge(): void {
  updater.dismissNudge()
}

export function dismissAvailableUpdate(): void {
  updater.dismissAvailableUpdate()
}

export function setupAutoUpdater(
  mainWindow: BrowserWindow | null,
  opts?: UpdaterSetupOptions
): void {
  if (!isAppUpdaterEnabled()) {
    return
  }
  updater.setupAutoUpdater(mainWindow, opts)
}
