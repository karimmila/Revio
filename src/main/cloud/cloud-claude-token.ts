import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { sealCloudSecret } from './cloud-secret-seal'
import { writeSecureFile } from '../../shared/secure-file'
import { cloudDataRoot } from './cloud-repo-store'

const SEALED = 'orca-cloud-claude:v1:sealed:'
// Read only: files written before Orca refused to store secrets without the keychain.
const PLAIN = 'orca-cloud-claude:v1:plaintext:'

// The token `claude setup-token` prints stays on this Mac; the sandbox gets the placeholder.
export { CLAUDE_PLACEHOLDER_TOKEN } from '../../shared/cloud/cloud-claude-placeholder'

function file(): string {
  return join(cloudDataRoot(), 'claude-token.enc')
}

export function readCloudClaudeToken(): string | null {
  if (!existsSync(file())) {
    return null
  }
  const raw = readFileSync(file(), 'utf8')
  if (raw.startsWith(SEALED)) {
    return getSecretStore().decryptString(Buffer.from(raw.slice(SEALED.length), 'base64'))
  }
  return raw.startsWith(PLAIN)
    ? Buffer.from(raw.slice(PLAIN.length), 'base64').toString('utf8')
    : null
}

/**
 * Whether a setup-token is saved, from the file alone. Settings and first-run onboarding ask this
 * on open; decrypting there would reach the Keychain before the person did anything.
 */
export function hasCloudClaudeToken(): boolean {
  if (!existsSync(file())) {
    return false
  }
  const raw = readFileSync(file(), 'utf8')
  return raw.startsWith(SEALED) || raw.startsWith(PLAIN)
}

export function writeCloudClaudeToken(token: string): void {
  const trimmed = token.trim()
  if (!/^sk-ant-oat01-[\w-]{20,}$/.test(trimmed)) {
    throw new Error('That does not look like a token from claude setup-token.')
  }
  writeSecureFile(file(), `${SEALED}${sealCloudSecret(trimmed)}`)
}

export function clearCloudClaudeToken(): void {
  rmSync(file(), { force: true })
}
