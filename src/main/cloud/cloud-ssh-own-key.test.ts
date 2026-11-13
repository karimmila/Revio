import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { setCloudDataRoot } from './cloud-repo-store'
import {
  adoptOwnWorkspaceKey,
  createWorkspaceKey,
  removeWorkspaceKey,
  workspaceIdentityFile,
  workspaceKeyPath
} from './cloud-ssh-access'

describe('own SSH key for cloud workspaces', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'orca-cloud-key-'))
    setCloudDataRoot(() => join(dir, 'cloud'))
  })

  it('sends only the public half and makes ssh use the private key in place', () => {
    const key = join(dir, 'id_test')
    writeFileSync(key, 'PRIVATE')
    writeFileSync(`${key}.pub`, 'ssh-ed25519 AAAAC3Nza me@mac\n')
    expect(adoptOwnWorkspaceKey('w1', key)).toBe('ssh-ed25519 AAAAC3Nza me@mac')
    expect(workspaceIdentityFile('w1')).toBe(key)
    removeWorkspaceKey('w1')
    expect(workspaceIdentityFile('w1')).toBe(workspaceKeyPath('w1'))
  })

  it('refuses a key without its public half or a relative path', () => {
    const key = join(dir, 'id_nopub')
    writeFileSync(key, 'PRIVATE')
    expect(() => adoptOwnWorkspaceKey('w2', key)).toThrow(/public key/)
    expect(() => adoptOwnWorkspaceKey('w2', 'id_rel')).toThrow(/not found/)
  })

  it('a generated key replaces an earlier own key', async () => {
    const key = join(dir, 'id_test2')
    writeFileSync(key, 'PRIVATE')
    writeFileSync(`${key}.pub`, 'ssh-ed25519 AAAA me')
    adoptOwnWorkspaceKey('w3', key)
    await createWorkspaceKey('w3').catch(() => undefined)
    expect(workspaceIdentityFile('w3')).toBe(workspaceKeyPath('w3'))
  })
})
