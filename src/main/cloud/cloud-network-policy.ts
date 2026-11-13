import type { NetworkPolicy, NetworkPolicyRule, NetworkTransformer } from '@vercel/sandbox'
import type { GithubRepoRef } from '../../shared/cloud/github-remote'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/**
 * Hosts a cloud workspace on "Allowlist" may reach besides its own GitHub repository and the
 * Anthropic broker: package registries, Ubuntu and Docker mirrors, and GitHub's download hosts.
 * Every one of them is read-only (GET and HEAD): nothing in the sandbox can publish a package or
 * push an image through them.
 */
export const ALLOWLIST_DOMAINS: readonly string[] = [
  'registry.npmjs.org',
  'registry.yarnpkg.com',
  'pypi.org',
  'files.pythonhosted.org',
  'proxy.golang.org',
  'sum.golang.org',
  'crates.io',
  'static.crates.io',
  'archive.ubuntu.com',
  'security.ubuntu.com',
  'ports.ubuntu.com',
  '*.ubuntu.com',
  // apt sources that Chrome (our base layer) and the GitHub CLI (Vercel's image) add; without
  // them apt-get update warns.
  'dl.google.com',
  'cli.github.com',
  // Where GitHub release downloads and raw files redirect to.
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
  'registry-1.docker.io',
  'auth.docker.io',
  'production.cloudflare.docker.com',
  '*.docker.io',
  // Claude Code's installer and release downloads.
  'claude.ai',
  'downloads.claude.ai'
]

export type SandboxNetwork = { mode: 'open' | 'allowlist'; extraDomains: readonly string[] }

/** New workspaces start closed; "Open" is the person's explicit choice per repository. */
export const DEFAULT_SANDBOX_NETWORK: SandboxNetwork = { mode: 'allowlist', extraDomains: [] }

/** A domain a person may add: host names with an optional leading "*.", nothing else. */
export function isAllowedDomainEntry(entry: string): boolean {
  return /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i.test(entry)
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One path segment that can never be "." or "..", and no percent-escapes at all, so neither
// `../` nor `%2e%2e` / `%2F` can walk a matched prefix into another repository: the proxy and
// GitHub may decode or normalise a path differently, so anything ambiguous is refused outright.
const SEGMENT = '\\.?[A-Za-z0-9_~,:@+=-][A-Za-z0-9_.~,:@+=-]*'
const QUERY = '(\\?[^#\\s]*)?'

/** Paths of api.github.com one repository's workspace may use, by HTTP method. */
export function githubApiPathPatterns(repo: GithubRepoRef): {
  read: string[]
  write: { method: string; regex: string }[]
} {
  const base = `/repos/${escapeRegex(repo.owner)}/${escapeRegex(repo.name)}`
  return {
    read: [`^${base}(/${SEGMENT})*${QUERY}$`, `^/user${QUERY}$`],
    write: [
      { method: 'POST', regex: `^${base}/pulls${QUERY}$` },
      { method: 'PATCH', regex: `^${base}/pulls/[0-9]+${QUERY}$` },
      { method: 'POST', regex: `^${base}/(issues|pulls)/[0-9]+/comments${QUERY}$` }
    ]
  }
}

/** Git smart-HTTP paths of the repository on github.com. */
export function githubGitPathPatterns(repo: GithubRepoRef): {
  refs: string
  uploadPack: string
  receivePack: string
} {
  const base = `^/${escapeRegex(repo.owner)}/${escapeRegex(repo.name)}\\.git`
  return {
    refs: `${base}/info/refs${QUERY}$`,
    uploadPack: `${base}/git-upload-pack$`,
    receivePack: `${base}/git-receive-pack$`
  }
}

/**
 * Public release downloads of any repository (install scripts fetch tools such as uv or the
 * Supabase CLI from GitHub releases). They pass through untouched, without the token.
 */
export const GITHUB_RELEASE_DOWNLOAD_PATH = `^/[^/%]+/[^/%]+/releases/(latest/)?download/(${SEGMENT})(/${SEGMENT})*$`

// Vercel's firewall only lets a rule claim a request when it changes something: an empty
// transform (or empty headers) falls through to the 403 below (probed live 2026-11-08). A
// harmless marker header makes a request pass, still without any token.
function pass(marker: string): NetworkTransformer[] {
  return [{ headers: { 'x-orca-egress': marker } }]
}

const READ_METHODS = ['GET', 'HEAD']

function refuse(body: string): NetworkPolicyRule {
  return {
    response: { statusCode: 403, body: `${FORK_PRODUCT_NAME}: ${body}`, contentType: 'text/plain' }
  }
}

const OWN_REPOSITORY_ONLY = refuse(
  'this sandbox may only reach its own repository, and only for reads, pushes and pull requests'
)

/** Paths Claude Code calls with its OAuth token: inference, the model list and its account reads. */
export const ANTHROPIC_POST_PATHS = [`^/v1/messages(/count_tokens)?${QUERY}$`]
export const ANTHROPIC_GET_PATHS = [
  `^/v1/models(/${SEGMENT})?${QUERY}$`,
  `^/api/oauth/(profile|usage|claude_cli/roles)${QUERY}$`,
  `^/api/claude_code/(policy_limits|settings)${QUERY}$`
]

function anthropicRules(claudeToken: string | null): NetworkPolicyRule[] {
  const add = claudeToken
    ? [{ headers: { authorization: `Bearer ${claudeToken}` } }]
    : pass('anthropic-direct')
  return [
    ...ANTHROPIC_POST_PATHS.map((regex) => ({
      match: { method: ['POST'], path: { regex } },
      transform: add
    })),
    ...ANTHROPIC_GET_PATHS.map((regex) => ({
      match: { method: READ_METHODS, path: { regex } },
      transform: add
    })),
    // Claude Code's connectivity check, which carries no credential.
    { match: { method: READ_METHODS, path: { regex: '^/api/hello$' } }, transform: pass('hello') },
    refuse('only Claude inference passes the sandbox broker')
  ]
}

function readOnlyRules(): NetworkPolicyRule[] {
  return [
    { match: { method: READ_METHODS }, transform: pass('read') },
    refuse('this host is read-only from a cloud sandbox')
  ]
}

function githubRules(
  repo: GithubRepoRef,
  token: string | null,
  readOnly: boolean
): { git: NetworkPolicyRule[]; api: NetworkPolicyRule[] } {
  const releases: NetworkPolicyRule = {
    match: { method: READ_METHODS, path: { regex: GITHUB_RELEASE_DOWNLOAD_PATH } },
    transform: pass('release-download')
  }
  if (!token) {
    return { git: [releases, OWN_REPOSITORY_ONLY], api: [OWN_REPOSITORY_ONLY] }
  }
  const git = githubGitPathPatterns(repo)
  const basic = [
    {
      headers: {
        authorization: `Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
      }
    }
  ]
  const bearer = [{ headers: { authorization: `Bearer ${token}` } }]
  const service = (name: string): NetworkPolicyRule => ({
    match: {
      method: ['GET'],
      path: { regex: git.refs },
      queryString: [{ key: { exact: 'service' }, value: { exact: name } }]
    },
    transform: basic
  })
  const paths = githubApiPathPatterns(repo)
  return {
    git: [
      service('git-upload-pack'),
      { match: { method: ['POST'], path: { regex: git.uploadPack } }, transform: basic },
      ...(readOnly
        ? []
        : [
            service('git-receive-pack'),
            { match: { method: ['POST'], path: { regex: git.receivePack } }, transform: basic }
          ]),
      releases,
      OWN_REPOSITORY_ONLY
    ],
    api: [
      ...paths.read.map((regex) => ({
        match: { method: READ_METHODS, path: { regex } },
        transform: bearer
      })),
      ...(readOnly
        ? []
        : paths.write.map(({ method, regex }) => ({
            match: { method: [method], path: { regex } },
            transform: bearer
          }))),
      OWN_REPOSITORY_ONLY
    ]
  }
}

const BROKERED = new Set(['github.com', 'api.github.com', 'api.anthropic.com'])

/**
 * The sandbox's network rules. Vercel's firewall adds the signed-in person's GitHub App user
 * token (refreshed by main, and pushed into running sandboxes when it rotates) only to this repository's git traffic and to the REST calls a workspace needs (reads, PR
 * create/update, comments), and answers 403 for everything else on GitHub: no GraphQL (it
 * reaches every repository the token covers), no merges, ref or contents writes, deletes or
 * forks. The Claude token is added to inference calls only. Without a token GitHub is 403
 * throughout. `readOnly` (builds) never pushes. "Open" lets every other host through;
 * "Allowlist" only the read-only hosts above plus the repository's extra domains.
 */
export function sandboxNetworkPolicy(
  repo: GithubRepoRef,
  token: string | null,
  claudeToken: string | null = null,
  network: SandboxNetwork = DEFAULT_SANDBOX_NETWORK,
  options: { readOnly?: boolean } = {}
): NetworkPolicy {
  const github = githubRules(repo, token, options.readOnly === true)
  // Lower case, so "GitHub.com" or "Registry.npmjs.org" cannot add a second, allow-all entry for
  // a host whose rules above broker a token or keep it read-only.
  const extra = network.extraDomains
    .filter(isAllowedDomainEntry)
    .map((domain) => domain.toLowerCase())
  const allow: Record<string, NetworkPolicyRule[]> = {
    'github.com': github.git,
    'api.github.com': github.api,
    'api.anthropic.com': anthropicRules(claudeToken)
  }
  for (const domain of ALLOWLIST_DOMAINS) {
    allow[domain] = readOnlyRules()
  }
  for (const domain of network.mode === 'open' ? ['*'] : extra) {
    if (!BROKERED.has(domain) && !(domain in allow)) {
      allow[domain] = []
    }
  }
  return { allow }
}
