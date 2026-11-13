import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { FORK_APP_ID, FORK_PRODUCT_NAME, FORK_USER_DATA_DIR_NAME } from '../../shared/fork-identity'
import {
  macCoordinationRoot,
  SERVE_LAUNCHD_LABEL_PREFIX
} from '../../shared/serve-bundle-coordination'
import { getDevInstanceIdentity } from './dev-instance-identity'
import { buildRevioLink, parseRevioLink } from '../../shared/revio-link'
import { macDaemonJobLabel } from '../daemon/executable-host/macos/macos-daemon-job-label'
import { DEFAULT_MAC_COMMAND_PATH } from '../cli/cli-install-constants'

// The CLI sits outside this project's typecheck (config/tsconfig.node.json), so its module is
// loaded at run time with only the signature this test needs.
const CLI_METADATA = '../../cli/runtime/metadata'
const cliMetadata: {
  getPlatformUserDataPath: (platform: NodeJS.Platform, homeDir: string) => string
} = await import(CLI_METADATA)
const { getPlatformUserDataPath } = cliMetadata

const builderConfig: {
  appId: string
  productName: string
  publish: unknown
  copyright: string
  protocols: { schemes: string[] }[]
  win: { executableName: string }
} = createRequire(import.meta.url)('../../../config/electron-builder.config.cjs')

describe('fork identity', () => {
  it('never reuses a real Orca install bundle id, name or profile folder', () => {
    expect(FORK_APP_ID).not.toBe('com.stablyai.orca')
    expect(FORK_PRODUCT_NAME).not.toBe('Orca')
    expect(FORK_USER_DATA_DIR_NAME).not.toBe('orca')
  })

  it('packages with the same identity the app runs with', () => {
    expect(builderConfig.appId).toBe(FORK_APP_ID)
    expect(builderConfig.productName).toBe(FORK_PRODUCT_NAME)
    expect(builderConfig.copyright).toContain('Lovecast Inc.')
    // No feed of our own: nothing is published to, or embedded from, upstream's releases.
    expect(builderConfig.publish).toBeNull()
  })

  it('names packaged builds after the fork and leaves dev builds on upstream ids', () => {
    const packaged = getDevInstanceIdentity(false)
    expect(packaged.appName).toBe(FORK_PRODUCT_NAME)
    expect(packaged.appUserModelId).toBe(FORK_APP_ID)

    const dev = getDevInstanceIdentity(true, { ORCA_DEV_REPO_ROOT: '/repo' })
    expect(dev.appName).toBe('Orca Dev')
    expect(dev.appUserModelId.startsWith('com.stablyai.orca.dev.')).toBe(true)
    // Only the shown title takes the fork's name; the Keychain-bound app name above stays.
    expect(dev.name).toBe(`${FORK_PRODUCT_NAME} Dev: repo`)
  })

  it('resolves the packaged profile folder the CLI looks for to the fork folder', () => {
    expect(getPlatformUserDataPath('darwin', '/Users/me')).toBe(
      `/Users/me/Library/Application Support/${FORK_USER_DATA_DIR_NAME}`
    )
    expect(macCoordinationRoot('/Users/me')).toBe(
      `/Users/me/Library/Application Support/${FORK_USER_DATA_DIR_NAME}`
    )
  })

  it('registers, installs and labels under fork names, never upstream Orca ones', () => {
    expect(builderConfig.protocols[0]?.schemes).toEqual(['revio'])
    expect(builderConfig.win.executableName).toBe(FORK_PRODUCT_NAME)
    expect(DEFAULT_MAC_COMMAND_PATH).toBe('/usr/local/bin/revio')
    expect(SERVE_LAUNCHD_LABEL_PREFIX).toBe(`${FORK_APP_ID}.serve`)
    expect(macDaemonJobLabel('/p', 7, true).startsWith(`${FORK_APP_ID}.terminal.`)).toBe(true)
    // Dev keeps the old prefix so its running daemon is still found.
    expect(macDaemonJobLabel('/p', 7, false).startsWith('com.stablyai.orca.terminal.')).toBe(true)
  })

  it('writes workspace links with the fork scheme and still reads orca:// ones', () => {
    const link = buildRevioLink({ worktreeId: 'w1' })
    expect(link.startsWith('revio://workspace?')).toBe(true)
    expect(parseRevioLink(link)).toEqual({ worktreeId: 'w1' })
    expect(parseRevioLink('orca://workspace?id=w2')).toEqual({ worktreeId: 'w2' })
    expect(parseRevioLink('https://workspace?id=w2')).toBeNull()
  })
})
