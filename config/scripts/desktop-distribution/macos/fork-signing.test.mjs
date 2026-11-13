import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { forkCodesignArgs, forkOsxSignOptions, readForkSigning } = require('./fork-signing.cjs')

const SHA1 = 'adbdeebad8cc9731fd71861d547426ae66775fec'
const KEYCHAIN = '/Users/me/Library/Keychains/orcafork-signing.keychain-db'

describe('readForkSigning', () => {
  it('stays unsigned when the identity is unset', () => {
    expect(readForkSigning({}, { isMacRelease: false })).toBeNull()
    expect(readForkSigning({ ORCA_FORK_SIGN_IDENTITY: '  ' }, { isMacRelease: false })).toBeNull()
  })

  it('never applies to release builds', () => {
    expect(readForkSigning({ ORCA_FORK_SIGN_IDENTITY: SHA1 }, { isMacRelease: true })).toBeNull()
  })

  it('reads the certificate SHA-1 and the keychain', () => {
    expect(
      readForkSigning(
        { ORCA_FORK_SIGN_IDENTITY: SHA1, ORCA_FORK_SIGN_KEYCHAIN: KEYCHAIN },
        { isMacRelease: false }
      )
    ).toEqual({ identity: SHA1.toUpperCase(), keychain: KEYCHAIN })
  })

  it('refuses a name instead of the SHA-1', () => {
    expect(() =>
      readForkSigning({ ORCA_FORK_SIGN_IDENTITY: 'Orca Fork Self-Signed' }, { isMacRelease: false })
    ).toThrow(/SHA-1/)
  })
})

describe('forkCodesignArgs', () => {
  const signing = { identity: SHA1.toUpperCase(), keychain: KEYCHAIN }

  it('signs with the identity and keychain, without hardened runtime or timestamp', () => {
    const args = forkCodesignArgs(signing, '/App.app/Contents/MacOS/helper', {
      entitlements: '/e.plist'
    })
    expect(args).toEqual([
      '--force',
      '--sign',
      SHA1.toUpperCase(),
      '--keychain',
      KEYCHAIN,
      '--entitlements',
      '/e.plist',
      '/App.app/Contents/MacOS/helper'
    ])
    expect(args).not.toContain('--options')
    expect(args).not.toContain('--timestamp')
  })

  it('signs a nested app deep when asked', () => {
    expect(forkCodesignArgs({ identity: 'X', keychain: null }, '/H.app', { deep: true })).toEqual([
      '--force',
      '--deep',
      '--sign',
      'X',
      '/H.app'
    ])
  })
})

describe('forkOsxSignOptions', () => {
  it('skips identity validation, keeps the runtime off and passes the ignore list', () => {
    const options = forkOsxSignOptions(
      { identity: 'X', keychain: KEYCHAIN },
      {
        appPath: '/A.app',
        entitlements: '/e.plist',
        ignore: ['/Contents/Resources/agent-browser-darwin-[^/]+$']
      }
    )
    expect(options).toMatchObject({
      app: '/A.app',
      identity: 'X',
      keychain: KEYCHAIN,
      identityValidation: false,
      ignore: ['/Contents/Resources/agent-browser-darwin-[^/]+$']
    })
    expect(options.optionsForFile('/A.app/Contents/MacOS/A')).toEqual({
      entitlements: '/e.plist',
      hardenedRuntime: false
    })
  })
})
