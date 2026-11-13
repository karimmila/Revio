import { getGithubAppAuthProvider } from '../git/command-runner/github-app-auth'
import type { GhAuthDiagnostic, GhAuthAccount } from '../../shared/github/auth-types'

// ProjectV2 and surrounding repository/organization queries require these scopes.
const REQUIRED_SCOPES = ['project', 'read:org', 'repo'] as const

/** gh auth status has used both streams; accept either supplied diagnostic text. */
export function parseAuthStatus(text: string): GhAuthAccount[] {
  const accounts: GhAuthAccount[] = []
  let currentHost: string | null = null
  let current: GhAuthAccount | null = null
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    // Accept single-label Enterprise hosts and optional trailing colons.
    const hostMatch = line.match(/^([a-z0-9][a-z0-9.-]*(?::\d+)?)\s*:?\s*$/i)
    if (hostMatch && !/^logged\b/i.test(line)) {
      currentHost = hostMatch[1]
      continue
    }
    const loggedIn = line.match(/Logged in to (\S+) account (\S+)(?:\s+\(([^)]+)\))?/i)
    if (loggedIn) {
      if (current) {
        accounts.push(current)
      }
      // Inline host labels survive unfamiliar section-header formats.
      const host = loggedIn[1] || currentHost || 'github.com'
      const sourceLabel = (loggedIn[3] ?? '').trim()
      const envToken =
        sourceLabel === 'GITHUB_TOKEN' || sourceLabel === 'GH_TOKEN' ? sourceLabel : null
      current = {
        host,
        user: loggedIn[2],
        active: false,
        envToken,
        source: envToken ? 'env' : 'keyring',
        scopes: []
      }
      continue
    }
    if (!current) {
      continue
    }
    const activeMatch = line.match(/Active account:\s*(true|false)/i)
    if (activeMatch) {
      current.active = activeMatch[1].toLowerCase() === 'true'
      continue
    }
    const scopesMatch = line.match(/Token scopes:\s*(.+)$/i)
    if (scopesMatch) {
      current.scopes = scopesMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
  }
  if (current) {
    accounts.push(current)
  }
  return accounts
}

/** gh auth status lists a refused token as "Failed to log in to <host> account <user>". */
export function parseRejectedAccounts(text: string): { host: string; user: string }[] {
  return [...text.matchAll(/Failed to log in to (\S+) account (\S+)/gi)].map((match) => ({
    host: match[1] ?? '',
    user: match[2] ?? ''
  }))
}

/**
 * The GitHub identity Revio uses: the GitHub App sign-in. No `gh auth status` (a keychain read).
 * App tokens carry no OAuth scopes; the app's permissions stand in for them, so none are missing.
 */
export async function diagnoseGhAuth(
  requiredHost?: string,
  _execOptions: { cwd?: string; wslDistro?: string } = {}
): Promise<GhAuthDiagnostic> {
  const provider = getGithubAppAuthProvider()
  const host = provider?.host() ?? null
  const login = provider?.login() ?? null
  const active: GhAuthAccount | null =
    host && login
      ? {
          host,
          user: login,
          active: true,
          envToken: null,
          source: 'env',
          scopes: [...REQUIRED_SCOPES]
        }
      : null
  const normalizedRequiredHost = requiredHost?.trim().toLowerCase() || null
  const hostActive =
    normalizedRequiredHost && active && active.host !== normalizedRequiredHost ? null : active
  return {
    ghAvailable: true,
    activeAccount: hostActive,
    accounts: active ? [active] : [],
    envTokenInProcess: null,
    missingScopes: hostActive ? [] : [...REQUIRED_SCOPES],
    requiredScopes: [...REQUIRED_SCOPES],
    hasKeyringFallback: false,
    requiredHost: normalizedRequiredHost,
    requiredHostAuthenticated: normalizedRequiredHost ? hostActive !== null : null,
    rejectedAccounts: []
  }
}
