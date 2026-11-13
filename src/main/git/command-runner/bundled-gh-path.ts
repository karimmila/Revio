import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-environment'

/*
 * The macOS app ships GitHub's gh under Contents/Resources/gh (config/bundled-gh-resources.cjs),
 * so GitHub features work on a Mac that never installed it. A gh on PATH still comes first: this
 * one is only used when spawning `gh` fails because there is none.
 */
let cachedPath: string | null | undefined
let selected = false

/** The gh inside this app bundle; null in dev, on other platforms, and in a build without one. */
export function bundledGhPath(): string | null {
  if (cachedPath !== undefined) {
    return cachedPath
  }
  const packaged = hasAppEnvironment() && getAppEnvironment().isPackaged()
  if (process.platform !== 'darwin' || !packaged || !process.resourcesPath) {
    cachedPath = null
    return cachedPath
  }
  const candidate = join(process.resourcesPath, 'gh', 'gh')
  cachedPath = existsSync(candidate) ? candidate : null
  return cachedPath
}

/** After one call ran with the bundled gh, later calls go straight to it instead of failing first. */
export function selectBundledGh(): void {
  selected = true
}

export function selectedBundledGhPath(): string | null {
  return selected ? bundledGhPath() : null
}

/** @internal - tests reset the module state between cases. */
export function _resetBundledGhForTests(path?: string | null): void {
  cachedPath = path
  selected = false
}
