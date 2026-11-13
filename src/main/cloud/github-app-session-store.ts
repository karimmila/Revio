import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { getSecretStore } from '../../shared/secret-store'
import { writeSecureFile } from '../../shared/secure-file'
import { sealCloudSecret } from './cloud-secret-seal'
import { cloudDataRoot } from './cloud-repo-store'

/**
 * The sealed GitHub session, unsealed at most once per run. Every gh call, poll and status read
 * asks for the token; each unseal is a safeStorage read, and with the login keychain locked each
 * read can raise a macOS password dialog. So the first answer is kept in memory, and a refused
 * unseal is latched: no further keychain reads until the person signs in or asks for a re-check.
 */
const SEALED = 'orca-cloud-github-app:v1:sealed:'

export const SessionSchema = z.object({
  clientId: z.string(),
  host: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  accessExpiresAt: z.number().nullable(),
  refreshExpiresAt: z.number().nullable(),
  login: z.string(),
  userId: z.number()
})
export type Session = z.infer<typeof SessionSchema>

type Cache = { state: 'unread' } | { state: 'read'; session: Session | null } | { state: 'refused' }

let cache: Cache = { state: 'unread' }
const refusedListeners = new Set<() => void>()

export function sessionFile(): string {
  return join(cloudDataRoot(), 'github-app-session.enc')
}

/** Called once per refusal, not per read: the caller shows a single notice. */
export function onSessionKeychainRefused(listener: () => void): () => void {
  refusedListeners.add(listener)
  return () => refusedListeners.delete(listener)
}

function unseal(): Cache {
  if (!existsSync(sessionFile())) {
    return { state: 'read', session: null }
  }
  let raw: string
  try {
    raw = readFileSync(sessionFile(), 'utf8')
  } catch {
    return { state: 'read', session: null }
  }
  if (!raw.startsWith(SEALED)) {
    return { state: 'read', session: null }
  }
  let json: string
  try {
    json = getSecretStore().decryptString(Buffer.from(raw.slice(SEALED.length), 'base64'))
  } catch {
    // The keychain refused (locked, denied) or is unreachable. The file stays: it is still good
    // once the keychain opens, and deleting it would sign the person out over a dismissed dialog.
    return { state: 'refused' }
  }
  try {
    const parsed = SessionSchema.safeParse(JSON.parse(json))
    return { state: 'read', session: parsed.success ? parsed.data : null }
  } catch {
    return { state: 'read', session: null }
  }
}

export function readStoredSession(): Session | null {
  if (cache.state === 'unread') {
    cache = unseal()
    if (cache.state === 'refused') {
      for (const listener of refusedListeners) {
        try {
          listener()
        } catch {
          // A listener's failure must not turn a refusal into a crash.
        }
      }
    }
  }
  return cache.state === 'read' ? cache.session : null
}

export function sessionKeychainRefused(): boolean {
  return cache.state === 'refused'
}

/** The person acted (re-check, sign-in): the next read may ask the keychain once more. */
export function retrySessionUnseal(): void {
  if (cache.state === 'refused') {
    cache = { state: 'unread' }
  }
}

export function writeStoredSession(session: Session): void {
  mkdirSync(cloudDataRoot(), { recursive: true, mode: 0o700 })
  writeSecureFile(sessionFile(), `${SEALED}${sealCloudSecret(JSON.stringify(session))}`)
  cache = { state: 'read', session }
}

export function removeStoredSession(): void {
  rmSync(sessionFile(), { force: true })
  cache = { state: 'read', session: null }
}

/** Test-only: forget the in-memory copy so a suite can exercise the first unseal again. */
export function _resetSessionCacheForTests(): void {
  cache = { state: 'unread' }
}
