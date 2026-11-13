import { posix, win32 } from 'node:path'

export function buildPackagedCliEntryPath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string {
  return getPathApi(platform).join(resourcesPath, 'app.asar.unpacked', 'out', 'cli', 'index.js')
}

export function normalizePathForPlatform(value: string, platform: NodeJS.Platform): string {
  const pathApi = getPathApi(platform)
  const normalized = pathApi.normalize(pathApi.isAbsolute(value) ? value : pathApi.resolve(value))
  return platform === 'win32' ? normalized.toLowerCase() : normalized
}

function getPathApi(platform: NodeJS.Platform): typeof win32 | typeof posix {
  return platform === 'win32' ? win32 : posix
}
