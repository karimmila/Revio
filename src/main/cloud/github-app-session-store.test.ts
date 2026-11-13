import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetSecretStoreForTests, setSecretStore } from '../../shared/secret-store'

const root = vi.hoisted(() => ({ dir: '' }))
vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => root.dir }))

import {
  _resetSessionCacheForTests,
  onSessionKeychainRefused,
  retrySessionUnseal
} from './github-app-session-store'
import {
  githubAccessToken,
  githubAccount,
  KEYCHAIN_REFUSED,
  saveGithubSession,
  signOutGithub
} from './github-app-session'
import { currentGithubAppConfig } from './github-app-settings'

function unsealFake(cipher: Buffer): string {
  return Buffer.from(cipher.toString('utf8').slice('sealed:'.length), 'hex').toString('utf8')
}

const decrypt = vi.fn(unsealFake)

function signIn(): void {
  const config = currentGithubAppConfig()
  if (!config.configured) {
    throw new Error('the fork ships a configured GitHub App')
  }
  saveGithubSession(
    config,
    {
      accessToken: 'ghu_live',
      refreshToken: 'ghr_live',
      accessExpiresAt: null,
      refreshExpiresAt: null
    },
    { login: 'octo', userId: 7 }
  )
}

beforeEach(() => {
  root.dir = mkdtempSync(join(tmpdir(), 'gh-app-store-'))
  decrypt.mockReset()
  decrypt.mockImplementation(unsealFake)
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('hex')}`),
    decryptString: decrypt,
    describeProtectionGap: () => null
  })
  signIn()
  // A fresh run: the session is on disk, nothing is in memory yet.
  _resetSessionCacheForTests()
})

afterEach(() => {
  signOutGithub()
  rmSync(root.dir, { recursive: true, force: true })
  _resetSecretStoreForTests()
})

describe('GitHub App session store', () => {
  it('unseals the stored session once, however many callers ask', async () => {
    for (let i = 0; i < 20; i++) {
      await expect(githubAccessToken()).resolves.toBe('ghu_live')
      expect(githubAccount()?.login).toBe('octo')
    }
    expect(decrypt).toHaveBeenCalledTimes(1)
  })

  it('latches a keychain refusal: one notice, no more keychain reads until the person acts', async () => {
    decrypt.mockImplementation(() => {
      throw new Error('keychain refused')
    })
    const notices = vi.fn()
    const off = onSessionKeychainRefused(notices)
    try {
      for (let i = 0; i < 10; i++) {
        await expect(githubAccessToken()).rejects.toThrow(KEYCHAIN_REFUSED)
        expect(githubAccount()).toBeNull()
      }
      expect(decrypt).toHaveBeenCalledTimes(1)
      expect(notices).toHaveBeenCalledTimes(1)

      // "Check again": the keychain may ask once more, and an unlocked one now answers.
      decrypt.mockImplementation(unsealFake)
      retrySessionUnseal()
      await expect(githubAccessToken()).resolves.toBe('ghu_live')
      expect(decrypt).toHaveBeenCalledTimes(2)
    } finally {
      off()
    }
  })
})
