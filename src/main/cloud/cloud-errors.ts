/**
 * What a person sees when a cloud step fails: never a token, never a stack. Vercel, GitHub and
 * Anthropic credentials only travel inside the sandbox firewall policy, but SDK errors can echo
 * request details, so every message is scrubbed before it is logged, shown or stored.
 */
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import { isNetworkFailure, unreachableServiceMessage } from '../../shared/network-failure'
const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(gh[oprsu]_|github_pat_)[A-Za-z0-9_]{10,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{10,}/g,
  /\bvca_[A-Za-z0-9_-]{10,}/g,
  /\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{16,}/g
]

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[redacted]'), text)
}

/** The HTTP status an SDK error carries, when it carries one. */
export function statusOfCloudError(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  const fields = Object.fromEntries(Object.entries(error))
  for (const key of ['status', 'statusCode']) {
    const value: unknown = fields[key]
    if (typeof value === 'number') {
      return value
    }
  }
  const response = 'response' in error ? error.response : undefined
  if (response && typeof response === 'object' && 'status' in response) {
    return typeof response.status === 'number' ? response.status : null
  }
  return null
}

/** Vercel answered that the sandbox does not exist (deleted outside Orca, or never created). */
export function isSandboxGone(error: unknown): boolean {
  if (statusOfCloudError(error) === 404) {
    return true
  }
  const raw = error instanceof Error ? error.message : String(error)
  return /sandbox.*not found|not_found/i.test(raw)
}

export type CloudErrorContext = 'workspace' | 'build' | 'snapshot'

/** A short, actionable sentence for the failures people actually hit. */
export function humanCloudError(error: unknown, context: CloudErrorContext = 'workspace'): string {
  const raw = redactSecrets(error instanceof Error ? error.message : String(error))
  const status = statusOfCloudError(error)
  // Orca's GitHub sign-in messages already say what to do, and "sign-in expired" is not Vercel's.
  if (
    /^(Install the .+ GitHub App on |Your GitHub sign-in expired|Sign in with GitHub |This build has no GitHub App|The custom GitHub App|GitHub answered |GitHub did not refresh |GitHub could not be reached |Could not reach GitHub|GitHub is )/.test(
      raw
    )
  ) {
    return raw.split('\n')[0] ?? raw
  }
  if (status === 401 || /unauthori[sz]ed|token.*(expired|invalid)|sign-in expired/i.test(raw)) {
    return `Vercel rejected ${FORK_PRODUCT_NAME}’s sign-in. Reconnect Vercel in Settings, Cloud.`
  }
  if (
    context === 'snapshot' &&
    (status === 404 || /snapshot.*(not found|expired|deleted)/i.test(raw))
  ) {
    return 'This repository’s cloud build is gone. Rebuild it in Settings, the repository, Cloud.'
  }
  if (status === 404 || /sandbox.*not found|not_found/i.test(raw)) {
    return 'This workspace’s sandbox no longer exists on Vercel. Archive the workspace; its files are gone.'
  }
  if (status === 429 || /too many requests|rate.?limit/i.test(raw)) {
    return 'Vercel is limiting requests right now. Wait a minute, then try again.'
  }
  // After the answers above: a dropped connection must not read as "fetch failed".
  if (status === null && (isNetworkFailure(error) || isNetworkFailure(raw))) {
    return unreachableServiceMessage('Vercel')
  }
  if (status === 402 || /plan|limit|quota/i.test(raw)) {
    // The SDK prefixes Vercel's own sentence with "Status code 402 is not ok:".
    // A create humanizes once where it fails and again on the way out; say "Vercel refused" once.
    const reason = (raw.split('\n')[0] ?? '')
      .replace(/^Status code \d+ is not ok:\s*/i, '')
      .replace(/^(Vercel refused:\s*)+/, '')
    return `Vercel refused: ${reason}`
  }
  return raw.split('\n')[0]?.slice(0, 300) ?? 'The cloud step failed.'
}
