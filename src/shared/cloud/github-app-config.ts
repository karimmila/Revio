/**
 * Which GitHub App cloud workspaces sign in with: the fork's own (fork-identity.json) unless the
 * person set another one in Settings > Advanced (a GHES host, or their own app).
 */
export type GithubAppDefaults = { clientId: string; slug: string; host: string }

/** What a person may override; an empty field falls back to the fork's value. */
export type GithubAppOverride = { clientId?: string; slug?: string; host?: string }

export type GithubAppConfig =
  | {
      configured: true
      clientId: string
      slug: string
      host: string
      /** `https://<host>`: device flow, OAuth and the app's install pages. */
      webBase: string
      /** api.github.com for github.com, `https://<host>/api/v3` for GitHub Enterprise Server. */
      apiBase: string
      custom: boolean
    }
  | { configured: false; message: string; custom: boolean }

export const GITHUB_DOT_COM = 'github.com'
/** The placeholder the fork ships until its GitHub App is registered. */
export const GITHUB_APP_PLACEHOLDER = 'TBD'

// GitHub App client ids look like "Iv1.0123456789abcdef" or "Iv23liAbCdEf0123456789".
const CLIENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,63}$/
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const HOST = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function isGithubAppClientId(value: string): boolean {
  return value !== GITHUB_APP_PLACEHOLDER && CLIENT_ID.test(value)
}

export function isGithubAppSlug(value: string): boolean {
  return value !== GITHUB_APP_PLACEHOLDER.toLowerCase() && SLUG.test(value)
}

export function isGithubHost(value: string): boolean {
  return HOST.test(value)
}

export function githubApiBase(host: string): string {
  return host === GITHUB_DOT_COM ? 'https://api.github.com' : `https://${host}/api/v3`
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/** Why an override cannot be saved, field by field; null when every set field is valid. */
export function githubAppOverrideProblem(override: GithubAppOverride): string | null {
  const clientId = clean(override.clientId)
  const slug = clean(override.slug)
  const host = clean(override.host).toLowerCase()
  if (clientId && !isGithubAppClientId(clientId)) {
    return 'That is not a GitHub App client ID (it looks like Iv23li… or Iv1.…).'
  }
  if (slug && !isGithubAppSlug(slug)) {
    return 'That is not a GitHub App name as it appears in its URL (lower case, digits and dashes).'
  }
  if (host && !isGithubHost(host)) {
    return 'That is not a host name, such as github.com or github.example.com.'
  }
  return null
}

/** The override with blanks dropped and the host lower-cased, ready to store. */
export function normalizeGithubAppOverride(override: GithubAppOverride): GithubAppOverride {
  const result: GithubAppOverride = {}
  const clientId = clean(override.clientId)
  const slug = clean(override.slug)
  const host = clean(override.host).toLowerCase()
  if (clientId) {
    result.clientId = clientId
  }
  if (slug) {
    result.slug = slug
  }
  if (host) {
    result.host = host
  }
  return result
}

export function resolveGithubAppConfig(
  defaults: GithubAppDefaults,
  override: GithubAppOverride = {}
): GithubAppConfig {
  const normalized = normalizeGithubAppOverride(override)
  const custom = Object.keys(normalized).length > 0
  if (githubAppOverrideProblem(normalized)) {
    return { configured: false, custom, message: 'The custom GitHub App in Settings is invalid.' }
  }
  const clientId = normalized.clientId ?? defaults.clientId
  const slug = normalized.slug ?? defaults.slug
  const host = normalized.host ?? defaults.host
  if (!isGithubAppClientId(clientId) || !isGithubAppSlug(slug) || !isGithubHost(host)) {
    return {
      configured: false,
      custom,
      message:
        'This build has no GitHub App configured yet. Set a client ID and app name in Settings > Advanced.'
    }
  }
  return {
    configured: true,
    clientId,
    slug,
    host,
    webBase: `https://${host}`,
    apiBase: githubApiBase(host),
    custom
  }
}

/**
 * Where a person installs the app (or asks an owner's admin to). With the owner's numeric id the
 * page opens on that account; GHES serves apps under /github-apps/.
 */
export function githubAppInstallUrl(
  config: { webBase: string; slug: string; host: string },
  ownerId?: number | null
): string {
  const section = config.host === GITHUB_DOT_COM ? 'apps' : 'github-apps'
  const base = `${config.webBase}/${section}/${encodeURIComponent(config.slug)}/installations/new`
  return ownerId && Number.isSafeInteger(ownerId) && ownerId > 0
    ? `${base}/permissions?target_id=${ownerId}`
    : base
}

/** Where a person revokes the app's access; Orca cannot revoke without a client secret. */
export function githubAuthorizationsUrl(config: { webBase: string }): string {
  return `${config.webBase}/settings/apps/authorizations`
}
