import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { sealCloudSecret } from '../cloud/cloud-secret-seal'
import { writeSecureFile } from '../../shared/secure-file'

export type VercelCredentials = {
  accessToken: string
  refreshToken: string | null
  /** Epoch milliseconds. */
  expiresAt: number
  teamId: string | null
  projectId: string | null
  /** 'token' is an access token the person pasted: it has no refresh and names one team. */
  kind?: 'oauth' | 'token'
  /** A pasted token's own expiry, when Vercel states one. */
  tokenExpiresAt?: number | null
}

const SEALED = 'orca-vercel-cloud:v1:sealed:'
// Read only: files written before Orca refused to store secrets without the keychain.
const PLAIN = 'orca-vercel-cloud:v1:plaintext:'

let rootDir: (() => string) | null = null

export function setVercelCredentialsRoot(next: () => string): void {
  rootDir = next
}

function credentialsFile(): string {
  if (!rootDir) {
    throw new Error('Vercel credentials root is not set')
  }
  return join(rootDir(), 'vercel-cloud.enc')
}

function isCredentials(value: unknown): value is VercelCredentials {
  return (
    !!value &&
    typeof value === 'object' &&
    'accessToken' in value &&
    typeof value.accessToken === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number'
  )
}

export function readVercelCredentials(): VercelCredentials | null {
  const file = credentialsFile()
  if (!existsSync(file)) {
    return null
  }
  const raw = readFileSync(file, 'utf8')
  let json: string
  if (raw.startsWith(SEALED)) {
    json = getSecretStore().decryptString(Buffer.from(raw.slice(SEALED.length), 'base64'))
  } else if (raw.startsWith(PLAIN)) {
    json = Buffer.from(raw.slice(PLAIN.length), 'base64').toString('utf8')
  } else {
    return null
  }
  const parsed: unknown = JSON.parse(json)
  return isCredentials(parsed)
    ? {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken ?? null,
        expiresAt: parsed.expiresAt,
        teamId: parsed.teamId ?? null,
        projectId: parsed.projectId ?? null,
        kind: parsed.kind === 'token' ? 'token' : 'oauth',
        tokenExpiresAt: parsed.tokenExpiresAt ?? null
      }
    : null
}

/**
 * Sealed with the OS keychain like Orca's other provider keys, in an owner-only file. Without a
 * usable keychain it throws instead of writing the token in the clear.
 */
export function writeVercelCredentials(credentials: VercelCredentials): void {
  const json = JSON.stringify(credentials)
  writeSecureFile(credentialsFile(), `${SEALED}${sealCloudSecret(json)}`)
}

export function clearVercelCredentials(): void {
  rmSync(credentialsFile(), { force: true })
}
