import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetSecretStoreForTests, setSecretStore } from '../../shared/secret-store'
import { limitsForPlan } from '../../shared/vercel-cloud/vercel-cloud-types'
import {
  clearVercelCredentials,
  readVercelCredentials,
  setVercelCredentialsRoot,
  writeVercelCredentials
} from './vercel-cloud-credentials'

const credentials = {
  accessToken: 'vca_secret',
  refreshToken: 'refresh',
  expiresAt: 1_800_000_000_000,
  teamId: 'team_1',
  projectId: 'orca-sandboxes'
}

describe('Vercel credentials', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-vercel-'))
    setVercelCredentialsRoot(() => root)
    setSecretStore({
      isEncryptionAvailable: () => true,
      encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('hex')}`),
      decryptString: (cipher) =>
        Buffer.from(cipher.toString('utf8').slice('sealed:'.length), 'hex').toString('utf8'),
      describeProtectionGap: () => null
    })
  })
  afterEach(() => {
    _resetSecretStoreForTests()
    rmSync(root, { recursive: true, force: true })
  })

  it('refuses to store the token without the keychain', () => {
    _resetSecretStoreForTests()
    expect(() => writeVercelCredentials(credentials)).toThrow(/keychain/)
    expect(readVercelCredentials()).toBeNull()
  })

  it('seals the token in an owner-only file and reads it back', () => {
    writeVercelCredentials(credentials)
    const file = join(root, 'vercel-cloud.enc')
    expect(readFileSync(file, 'utf8')).not.toContain('vca_secret')
    expect(statSync(file).mode & 0o077).toBe(0)
    // A record from before team tokens reads back as a sign-in with no token expiry.
    expect(readVercelCredentials()).toEqual({ ...credentials, kind: 'oauth', tokenExpiresAt: null })
    clearVercelCredentials()
    expect(readVercelCredentials()).toBeNull()
  })

  it('caps Hobby sandboxes below the limits Vercel enforces', () => {
    expect(limitsForPlan('hobby')).toMatchObject({ maxVcpus: 4, maxSessionMinutes: 45 })
    expect(limitsForPlan('pro')).toMatchObject({ maxVcpus: 8, maxSessionMinutes: 1440 })
  })
})
