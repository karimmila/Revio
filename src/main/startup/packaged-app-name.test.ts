import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

const mocks = vi.hoisted(() => {
  const calls: string[] = []
  return { isPackaged: false, calls }
})

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged
    },
    setName: (name: string) => mocks.calls.push(`setName:${name}`)
  }
}))

const builderConfig: { extraMetadata?: { productName?: string } } = createRequire(import.meta.url)(
  '../../../config/electron-builder.config.cjs'
)

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('packaged app name', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.calls = []
  })

  it('renames a packaged build to the fork name as soon as the module loads', async () => {
    mocks.isPackaged = true
    await import('./packaged-app-name')
    expect(mocks.calls).toEqual([`setName:${FORK_PRODUCT_NAME}`])
  })

  it('leaves a dev build on its own name', async () => {
    mocks.isPackaged = false
    await import('./packaged-app-name')
    expect(mocks.calls).toEqual([])
  })

  it('runs before any other main-process module can touch safeStorage or app paths', () => {
    const firstImport = readSource('../index.ts').match(/^import\s[^\n]*$/m)?.[0]
    expect(firstImport).toBe("import './startup/packaged-app-name'")
    // Its own imports must not pull in anything that could read the Keychain first.
    const ownImports = [...readSource('./packaged-app-name.ts').matchAll(/from '([^']+)'/g)].map(
      (match) => match[1]
    )
    expect(ownImports).toEqual(['electron', '../../shared/fork-identity'])
  })

  it('stamps the fork name into the packaged package.json, so Electron starts as Revio', () => {
    expect(builderConfig.extraMetadata?.productName).toBe(FORK_PRODUCT_NAME)
    expect(FORK_PRODUCT_NAME).toBe('Revio')
  })
})
