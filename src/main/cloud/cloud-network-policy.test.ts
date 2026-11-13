import { describe, expect, it } from 'vitest'
import type { NetworkPolicy, NetworkPolicyRule } from '@vercel/sandbox'
import {
  ALLOWLIST_DOMAINS,
  isAllowedDomainEntry,
  sandboxNetworkPolicy
} from './cloud-network-policy'

const repo = { owner: 'acme', name: 'web.app' }
const TOKEN = `github_pat_${'A1_'.repeat(10)}`
const CLAUDE = 'sk-ant-oat01-claude-token'
const BASIC = `Basic ${Buffer.from(`x-access-token:${TOKEN}`).toString('base64')}`

function rulesFor(policy: NetworkPolicy, host: string): NetworkPolicyRule[] {
  if (typeof policy !== 'object' || !policy.allow || Array.isArray(policy.allow)) {
    return []
  }
  return policy.allow[host] ?? []
}

function matches(rule: NetworkPolicyRule, method: string, url: string): boolean {
  const match = rule.match
  if (!match) {
    return true
  }
  if (match.method && !match.method.includes(method)) {
    return false
  }
  if (match.path && 'regex' in match.path && match.path.regex) {
    if (!new RegExp(match.path.regex).test(url)) {
      return false
    }
  }
  const query = new URLSearchParams(url.split('?')[1] ?? '')
  for (const entry of match.queryString ?? []) {
    const key = entry.key && 'exact' in entry.key ? entry.key.exact : undefined
    const value = entry.value && 'exact' in entry.value ? entry.value.exact : undefined
    if (key === undefined || query.get(key) !== value) {
      return false
    }
  }
  return true
}

/** What the sandbox proxy does with a request: the first rule that matches decides. */
function outcome(rules: NetworkPolicyRule[], method: string, url: string): string {
  const rule = rules.find((candidate) => matches(candidate, method, url))
  if (!rule) {
    return 'pass'
  }
  if (rule.response) {
    return `refused ${rule.response.statusCode}`
  }
  const auth = rule.transform?.[0]?.headers?.authorization
  return auth ? `token ${auth}` : 'pass'
}

describe('GitHub broker', () => {
  const policy = sandboxNetworkPolicy(repo, TOKEN, CLAUDE)
  const git = rulesFor(policy, 'github.com')
  const api = rulesFor(policy, 'api.github.com')
  const bearer = `token Bearer ${TOKEN}`

  it('adds the token to clone, fetch and push of this repository only', () => {
    const base = '/acme/web.app.git'
    expect(outcome(git, 'GET', `${base}/info/refs?service=git-upload-pack`)).toBe(`token ${BASIC}`)
    expect(outcome(git, 'GET', `${base}/info/refs?service=git-receive-pack`)).toBe(`token ${BASIC}`)
    expect(outcome(git, 'POST', `${base}/git-upload-pack`)).toBe(`token ${BASIC}`)
    expect(outcome(git, 'POST', `${base}/git-receive-pack`)).toBe(`token ${BASIC}`)
    for (const path of [
      '/acme/other.git/info/refs?service=git-upload-pack',
      '/acme/webXapp.git/git-upload-pack',
      '/acme/web.app-other.git/git-upload-pack',
      '/acme/web.app.git/info/lfs/objects/batch'
    ]) {
      expect(outcome(git, 'POST', path)).toBe('refused 403')
      expect(outcome(git, 'GET', path)).toBe('refused 403')
    }
  })

  it('lets a build clone but never push', () => {
    const build = rulesFor(
      sandboxNetworkPolicy(
        repo,
        TOKEN,
        null,
        { mode: 'open', extraDomains: [] },
        { readOnly: true }
      ),
      'github.com'
    )
    const base = '/acme/web.app.git'
    expect(outcome(build, 'POST', `${base}/git-upload-pack`)).toBe(`token ${BASIC}`)
    expect(outcome(build, 'GET', `${base}/info/refs?service=git-receive-pack`)).toBe('refused 403')
    expect(outcome(build, 'POST', `${base}/git-receive-pack`)).toBe('refused 403')
  })

  it('passes public release downloads without the token', () => {
    expect(outcome(git, 'GET', '/astral-sh/uv/releases/download/0.9.21/uv.tar.gz')).toBe('pass')
    expect(outcome(git, 'POST', '/astral-sh/uv/releases/download/0.9.21/uv.tar.gz')).toBe(
      'refused 403'
    )
    expect(outcome(git, 'GET', '/acme/other/archive/main.zip')).toBe('refused 403')
  })

  it('reads this repository and the user, and refuses GraphQL', () => {
    for (const path of [
      '/repos/acme/web.app',
      '/repos/acme/web.app/pulls?head=acme:feature&state=all',
      '/repos/acme/web.app/contents/.github/workflows/ci.yml',
      '/user'
    ]) {
      expect(outcome(api, 'GET', path)).toBe(bearer)
    }
    expect(outcome(api, 'POST', '/graphql')).toBe('refused 403')
    expect(outcome(api, 'GET', '/graphql')).toBe('refused 403')
    for (const path of ['/repos/acme/other', '/repos/acme/web.appx/pulls', '/user/repos']) {
      expect(outcome(api, 'GET', path)).toBe('refused 403')
    }
  })

  it('allows pull request create, update and comments, nothing else that writes', () => {
    expect(outcome(api, 'POST', '/repos/acme/web.app/pulls')).toBe(bearer)
    expect(outcome(api, 'PATCH', '/repos/acme/web.app/pulls/12')).toBe(bearer)
    expect(outcome(api, 'POST', '/repos/acme/web.app/issues/12/comments')).toBe(bearer)
    expect(outcome(api, 'POST', '/repos/acme/web.app/pulls/12/comments')).toBe(bearer)
    for (const [method, path] of [
      ['PUT', '/repos/acme/web.app/pulls/12/merge'],
      ['DELETE', '/repos/acme/web.app'],
      ['DELETE', '/repos/acme/web.app/git/refs/heads/main'],
      ['PATCH', '/repos/acme/web.app/git/refs/heads/main'],
      ['POST', '/repos/acme/web.app/git/refs'],
      ['POST', '/repos/acme/web.app/forks'],
      ['PUT', '/repos/acme/web.app/contents/README.md'],
      ['PATCH', '/repos/acme/web.app'],
      ['POST', '/repos/acme/web.app/actions/workflows/ci.yml/dispatches'],
      ['POST', '/user/repos']
    ]) {
      expect(outcome(api, method!, path!), `${method} ${path}`).toBe('refused 403')
    }
  })

  it('refuses traversal and percent-escape tricks out of the repository prefix', () => {
    for (const path of [
      '/repos/acme/web.app/../other',
      '/repos/acme/web.app/./pulls',
      '/repos/acme/web.app/%2e%2e/other',
      '/repos/acme/web.app/%2E%2E/other',
      '/repos/acme/web.app%2F..%2Fother',
      '/repos/acme/web.app/pulls%2F..%2F..%2Fother',
      '/repos/acme/web.app//pulls',
      '/repos/acme/web.app\\..\\other',
      '/repos/acme/web.app/..%2fother'
    ]) {
      expect(outcome(api, 'GET', path), path).toBe('refused 403')
    }
    expect(outcome(api, 'POST', '/repos/acme/web.app/pulls/../../other/pulls')).toBe('refused 403')
    expect(outcome(git, 'POST', '/acme/web.app.git/../other.git/git-receive-pack')).toBe(
      'refused 403'
    )
    expect(outcome(git, 'POST', '/acme/web.app.git/%2e%2e/other.git/git-receive-pack')).toBe(
      'refused 403'
    )
    expect(outcome(git, 'GET', '/a/b/releases/download/../../../acme/other.git/info/refs')).toBe(
      'refused 403'
    )
    expect(outcome(git, 'GET', '/a/b/releases/download/%2e%2e/x')).toBe('refused 403')
  })

  it('closes GitHub entirely without a token', () => {
    const closed = sandboxNetworkPolicy(repo, null)
    expect(
      outcome(rulesFor(closed, 'github.com'), 'POST', '/acme/web.app.git/git-upload-pack')
    ).toBe('refused 403')
    expect(outcome(rulesFor(closed, 'api.github.com'), 'GET', '/repos/acme/web.app')).toBe(
      'refused 403'
    )
  })
})

describe('Anthropic broker', () => {
  const rules = rulesFor(sandboxNetworkPolicy(repo, TOKEN, CLAUDE), 'api.anthropic.com')
  const token = `token Bearer ${CLAUDE}`

  it('adds the Claude token to inference and Claude Code’s own reads only', () => {
    expect(outcome(rules, 'POST', '/v1/messages')).toBe(token)
    expect(outcome(rules, 'POST', '/v1/messages?beta=true')).toBe(token)
    expect(outcome(rules, 'POST', '/v1/messages/count_tokens?beta=true')).toBe(token)
    expect(outcome(rules, 'GET', '/v1/models')).toBe(token)
    expect(outcome(rules, 'GET', '/api/oauth/profile')).toBe(token)
    expect(outcome(rules, 'GET', '/api/hello')).toBe('pass')
  })

  it('refuses everything else, such as minting an API key with the token', () => {
    for (const [method, path] of [
      ['POST', '/api/oauth/claude_cli/create_api_key'],
      ['POST', '/v1/files'],
      ['POST', '/v1/messages/batches'],
      ['GET', '/v1/organizations/users'],
      ['POST', '/api/event_logging/batch'],
      ['GET', '/v1/messages/../organizations/users'],
      ['GET', '/v1/models/%2e%2e/organizations']
    ]) {
      expect(outcome(rules, method!, path!), path).toBe('refused 403')
    }
  })
})

describe('egress', () => {
  it('defaults to the allowlist, without telemetry hosts', () => {
    const policy = sandboxNetworkPolicy(repo, TOKEN, CLAUDE)
    const hosts = Object.keys(
      typeof policy === 'object' && policy.allow && !Array.isArray(policy.allow) ? policy.allow : {}
    )
    expect(hosts).not.toContain('*')
    expect(hosts.some((host) => /sentry|statsig/.test(host))).toBe(false)
    expect(hosts).not.toContain('*.anthropic.com')
  })

  it('keeps package registries and mirrors read-only, even when open', () => {
    for (const mode of ['open', 'allowlist'] as const) {
      const policy = sandboxNetworkPolicy(repo, TOKEN, CLAUDE, { mode, extraDomains: [] })
      for (const host of ALLOWLIST_DOMAINS) {
        const rules = rulesFor(policy, host)
        expect(outcome(rules, 'GET', '/some/package')).toBe('pass')
        expect(outcome(rules, 'HEAD', '/some/package')).toBe('pass')
        expect(outcome(rules, 'PUT', '/some/package')).toBe('refused 403')
        expect(outcome(rules, 'POST', '/-/v1/login')).toBe('refused 403')
      }
    }
  })

  it('adds the repository’s extra domains, and only real host names', () => {
    const policy = sandboxNetworkPolicy(repo, TOKEN, null, {
      mode: 'allowlist',
      extraDomains: ['api.example.com', 'not a domain', '*.internal.dev', 'github.com']
    })
    const hosts = Object.keys(
      typeof policy === 'object' && policy.allow && !Array.isArray(policy.allow) ? policy.allow : {}
    )
    expect(hosts).toContain('api.example.com')
    expect(hosts).toContain('*.internal.dev')
    expect(hosts).not.toContain('not a domain')
    expect(rulesFor(policy, 'github.com').at(-1)?.response?.statusCode).toBe(403)
    expect(isAllowedDomainEntry('evil.com/path')).toBe(false)
  })

  it('an extra domain in another letter case adds no second entry for a ruled host', () => {
    const policy = sandboxNetworkPolicy(repo, TOKEN, CLAUDE, {
      mode: 'allowlist',
      extraDomains: ['GitHub.com', 'API.github.com', 'Api.Anthropic.com', 'Registry.NPMJS.org']
    })
    const plain = sandboxNetworkPolicy(repo, TOKEN, CLAUDE, { mode: 'allowlist', extraDomains: [] })
    const hostsOf = (value: typeof policy): string[] =>
      Object.keys(
        typeof value === 'object' && value.allow && !Array.isArray(value.allow) ? value.allow : {}
      )
    expect(hostsOf(policy)).toEqual(hostsOf(plain))
    expect(rulesFor(policy, 'registry.npmjs.org')).toEqual(rulesFor(plain, 'registry.npmjs.org'))
  })
})
