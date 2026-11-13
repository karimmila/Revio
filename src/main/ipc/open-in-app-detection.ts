import { ipcMain, nativeImage } from 'electron'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { OPEN_IN_PRESET_MAC_BUNDLES, macAppBundleCandidates } from '../../shared/open-in-mac-apps'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Each installed Open in preset and the app bundle found for it; none on other platforms. */
async function findInstalledOpenInPresetBundles(
  platform: NodeJS.Platform,
  home: string,
  pathExists: (path: string) => Promise<boolean>
): Promise<[id: string, bundlePath: string][]> {
  if (platform !== 'darwin') {
    return []
  }
  const checks = await Promise.all(
    Object.entries(OPEN_IN_PRESET_MAC_BUNDLES).map(
      async ([id, bundle]): Promise<[string, string] | null> => {
        for (const candidate of macAppBundleCandidates(bundle, home)) {
          if (await pathExists(candidate)) {
            return [id, candidate]
          }
        }
        return null
      }
    )
  )
  return checks.filter((found): found is [string, string] => found !== null)
}

/** The Open in preset ids whose app bundle is on this Mac; none on other platforms. */
export async function detectInstalledOpenInPresets(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
  pathExists: (path: string) => Promise<boolean> = exists
): Promise<string[]> {
  const found = await findInstalledOpenInPresetBundles(platform, home, pathExists)
  return found.map(([id]) => id)
}

// A bundle's Quick Look thumbnail is its app icon; `app.getFileIcon` answers with one generic
// document icon for every .app bundle.
async function readAppIconDataUrl(bundlePath: string): Promise<string> {
  const icon = await nativeImage.createThumbnailFromPath(bundlePath, { width: 64, height: 64 })
  return icon.toDataURL()
}

/**
 * Each installed preset's own app icon, read from its bundle on this Mac. The menu used to load
 * these from a favicon service, which told a third party which editors a person has.
 */
export async function readInstalledOpenInPresetIcons(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
  pathExists: (path: string) => Promise<boolean> = exists,
  readIcon: (bundlePath: string) => Promise<string> = readAppIconDataUrl
): Promise<Record<string, string>> {
  const found = await findInstalledOpenInPresetBundles(platform, home, pathExists)
  const icons = await Promise.all(
    found.map(async ([id, bundlePath]): Promise<[string, string] | null> => {
      try {
        return [id, await readIcon(bundlePath)]
      } catch {
        return null
      }
    })
  )
  return Object.fromEntries(icons.filter((icon): icon is [string, string] => icon !== null))
}

export function registerOpenInAppDetectionHandler(): void {
  ipcMain.handle('shell:detectOpenInPresets', () => detectInstalledOpenInPresets())
  ipcMain.handle('shell:readOpenInPresetIcons', () => readInstalledOpenInPresetIcons())
}
