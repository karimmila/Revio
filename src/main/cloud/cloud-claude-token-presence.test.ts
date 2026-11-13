import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const decryptString = vi.fn(() => 'secret')
vi.mock('../../shared/secret-store', () => ({ getSecretStore: () => ({ decryptString }) }))

const { setCloudDataRoot } = await import('./cloud-repo-store')
const { hasCloudClaudeToken } = await import('./cloud-claude-token')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-claude-token-'))
  setCloudDataRoot(() => root)
  decryptString.mockClear()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

it('answers from the file alone, without decrypting (no Keychain access on open)', () => {
  expect(hasCloudClaudeToken()).toBe(false)
  writeFileSync(join(root, 'claude-token.enc'), 'orca-cloud-claude:v1:sealed:AAAA')
  expect(hasCloudClaudeToken()).toBe(true)
  expect(decryptString).not.toHaveBeenCalled()
})

it('ignores a file in an unknown format', () => {
  writeFileSync(join(root, 'claude-token.enc'), 'garbage')
  expect(hasCloudClaudeToken()).toBe(false)
})
