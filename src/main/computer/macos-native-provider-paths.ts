import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FORK_COMPUTER_USE_HELPER_NAME } from '../../shared/fork-identity'

const HELPER_APP = `${FORK_COMPUTER_USE_HELPER_NAME}.app`
/** Shown when the helper bundle is missing from this install. */
export const MACOS_COMPUTER_USE_APP_NOT_FOUND = `${HELPER_APP} was not found`

export function resolveMacOSComputerUseAppPath(): string | null {
  const override = process.env.ORCA_COMPUTER_MACOS_HELPER_APP_PATH
  if (override && existsSync(override)) {
    return override
  }

  const packaged = [join(process.resourcesPath ?? '', HELPER_APP)]
  const dev = [
    join(process.cwd(), 'native/computer-use-macos/.build/release', HELPER_APP),
    resolve(__dirname, '../../native/computer-use-macos/.build/release', HELPER_APP)
  ]
  const candidates = process.resourcesPath ? [...packaged, ...dev] : dev

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null
}

export function resolveMacOSComputerUseExecutablePath(): string | null {
  const appPath = resolveMacOSComputerUseAppPath()
  if (!appPath) {
    return null
  }
  const executablePath = join(appPath, 'Contents', 'MacOS', 'orca-computer-use-macos')
  return existsSync(executablePath) ? executablePath : null
}
