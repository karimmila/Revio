import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Revio must not send user data to the upstream company's hosted services. Every such endpoint
 * is named in fork-identity.json `services` and read through fork-services.ts. This scan fails
 * when an upstream hostname shows up in runtime code again, which an upstream merge can do
 * silently. Comments, tests and fixtures are fine: they never run in the shipped app.
 */
const ROOT = join(import.meta.dirname, '..', '..')

const UPSTREAM_HOSTS: { name: string; pattern: RegExp }[] = [
  { name: 'onorca.dev', pattern: /\bonorca\.dev\b/i },
  { name: 'orca.dev', pattern: /(?<![\w.-])orca\.dev\b/i },
  { name: 'official plugin catalog', pattern: /stablyai\/orca-plugins\b/i },
  { name: 'community plugin catalog', pattern: /orca-community-plugins\b/i },
  { name: 'raw.githubusercontent stablyai', pattern: /raw\.githubusercontent\.com\/stablyai\b/i },
  { name: 'GitHub API stablyai', pattern: /api\.github\.com\/repos\/stablyai\b/i },
  { name: 'PostHog', pattern: /\bposthog\.com\b/i },
  // Any link or project reference to the upstream GitHub organization, not only the API hosts.
  { name: 'GitHub stablyai', pattern: /\bgithub(?:\.com\/|:)stablyai\b/i },
  // The upstream release repos as bare "owner/repo" strings: a feed or channel constant that would
  // end up in the built bundles. Release repos derive from fork-identity.json's update feed.
  {
    name: 'upstream release repo',
    pattern: /['"`]stablyai\/orca(?:-hourly|-daily|-adhoc)?['"`]/i
  }
]

const SCANNED_ROOTS = ['src', 'config', 'resources', 'electron.vite.config.ts']
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json|html)$/

// Directories that never ship in the desktop app, or ship only as the release tooling itself.
const SKIPPED_DIRECTORIES = [
  'node_modules',
  'config/scripts/release',
  'src/renderer/src/i18n/locales',
  // Generated per-test timing data, keyed by test path.
  'config/scripts/ci/sharding',
  // A developer-run Windows hang reproduction that prints the upstream issue it was written for.
  'config/scripts/windows-apphang-repro'
]

const TEST_FILE =
  /(?:\.test\.|\.spec\.|[.-]fixtures?\.|test-support|test-harness|test-fixture|__mocks__|__fixtures__|[\\/]testing[\\/]|[\\/]fixtures?[\\/])/

/**
 * Runtime files that may still name an upstream host, with the reason. Keep this list short: a
 * new entry needs a reason that no request is made.
 */
const ALLOWED_RUNTIME_MENTIONS: Record<string, string> = {
  'resources/plugins/launch/stablyai.orca-github-vscode-theme/orca-plugin.json':
    'bundled theme; "repository" credits its source and is never fetched',
  'resources/plugins/launch/stablyai.orca-vscode-default-themes/orca-plugin.json':
    'bundled theme; "repository" credits its source and is never fetched',
  'resources/plugins/launch/stablyai.orca-multipass-recipes/orca-plugin.json':
    'packaged plugin source; "repository" credits its source and is never fetched',
  'resources/plugins/launch/orca-marketplace.json':
    'packaged with the plugins but never loaded: plugin-bundled-bootstrap reads bundled-plugins.json only',
  'src/shared/plugins/manifest/plugin-json-schema.ts':
    'the schema $id written into generated docs; nothing fetches it',
  'src/shared/plugins/manifest/plugin-schema-policy-notes.ts': 'plugin authoring text',
  'src/cli/bundled-skill-guides.ts': 'plugin authoring text',
  'src/main/telemetry/posthog-transport.ts':
    'reached only after telemetry starts, which needs services.telemetryWriteKey',
  'src/shared/plugins/catalog/plugin-default-catalogs.ts':
    'recognizes a stored upstream catalog so it can be hidden and never refreshed',
  'config/mobile-localization-coverage-allowlist.json': 'mobile app copy; mobile/ is out of scope',
  'config/vitest.config.ts':
    'the feed the updater test suites run against; a packaged build takes it from fork-identity.json'
}

/**
 * Every runtime file that names the GitHub REST API host, with what it sends there. GitHub work
 * goes through `gh` with the person's own sign-in; a direct call is an exception that must be
 * listed here, so a new one (an upstream merge, a shortcut) is a deliberate, reviewed choice.
 */
const GITHUB_API_HOST = /\bapi\.github\.com\b/i
const DIRECT_GITHUB_API_FILES: Record<string, string> = {
  'src/shared/release-notice.ts':
    'the new-version notice: one unauthenticated GET a day of releases/latest for fork-identity releasesRepo; no user data',
  'src/main/updater/releases/updater-release-builds.ts':
    'the self-updater, reached only with updateFeedGitHubRepo set; this fork ships it null',
  'src/shared/cloud/github-app-config.ts':
    "the API base of the GitHub App sign-in; calls carry the person's own app token",
  'src/main/cloud/cloud-network-policy.ts':
    'names the host in a sandbox firewall rule; main makes no request from here',
  'src/shared/cloud/cloud-pr-command.ts':
    "the text of the cloud sandbox's pull-request command: it runs inside the sandbox, for the sandbox's own repository, with the placeholder token; this app makes no request from here"
}

function findGithubApiMentions(files: readonly string[], read: (file: string) => string): string[] {
  const found = new Set<string>()
  for (const file of files) {
    if (!file.startsWith('src/') || TEST_FILE.test(file) || file.includes('/__fixtures__/')) {
      continue
    }
    for (const line of read(file).split('\n')) {
      const match = GITHUB_API_HOST.exec(line)
      if (match && !isCommentPosition(line, match.index)) {
        found.add(file)
      }
    }
  }
  return [...found].sort()
}

function walk(path: string, out: string[]): void {
  const rel = relative(ROOT, path).split(sep).join('/')
  if (SKIPPED_DIRECTORIES.some((dir) => rel === dir || rel.startsWith(`${dir}/`))) {
    return
  }
  let entries
  try {
    entries = readdirSync(path, { withFileTypes: true })
  } catch {
    if (CODE_FILE.test(path)) {
      out.push(rel)
    }
    return
  }
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      walk(child, out)
    } else if (CODE_FILE.test(entry.name)) {
      out.push(relative(ROOT, child).split(sep).join('/'))
    }
  }
}

/** True when the match sits in a line comment, a block-comment line, or a JSDoc line. */
function isCommentPosition(line: string, index: number): boolean {
  const before = line.slice(0, index)
  const trimmed = line.trimStart()
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true
  }
  // A `//` that follows whitespace or starts the line opens a comment; `https://` does not.
  return /(^|\s)\/\//.test(before) || /(^|\s)\/\*/.test(before)
}

function findUpstreamRuntimeMentions(
  files: readonly string[],
  read: (file: string) => string
): string[] {
  const found: string[] = []
  for (const file of files) {
    if (TEST_FILE.test(file) || ALLOWED_RUNTIME_MENTIONS[file]) {
      continue
    }
    const lines = read(file).split('\n')
    lines.forEach((line, lineIndex) => {
      for (const host of UPSTREAM_HOSTS) {
        const match = host.pattern.exec(line)
        if (match && !isCommentPosition(line, match.index)) {
          found.push(`${file}:${lineIndex + 1} ${host.name}: ${line.trim().slice(0, 140)}`)
        }
      }
    })
  }
  return found
}

describe('upstream hosted services stay out of runtime code', () => {
  it('finds no upstream hostname outside comments, tests and the allow-list', () => {
    const files: string[] = []
    for (const root of SCANNED_ROOTS) {
      walk(join(ROOT, root), files)
    }
    expect(files.length).toBeGreaterThan(1000)
    const mentions = findUpstreamRuntimeMentions(files, (file) =>
      readFileSync(join(ROOT, file), 'utf8')
    )
    expect(mentions).toEqual([])
  })

  it('names the GitHub API host only in the listed files', () => {
    const files: string[] = []
    walk(join(ROOT, 'src'), files)
    expect(findGithubApiMentions(files, (file) => readFileSync(join(ROOT, file), 'utf8'))).toEqual(
      Object.keys(DIRECT_GITHUB_API_FILES).sort()
    )
  })

  it('catches a new direct GitHub API call', () => {
    const sources: Record<string, string> = {
      'src/main/shortcut.ts': "await fetch('https://api.github.com/user')",
      'src/main/commented.ts': '// like https://api.github.com/user',
      'src/main/shortcut.test.ts': "fetch('https://api.github.com/user')"
    }
    expect(findGithubApiMentions(Object.keys(sources), (file) => sources[file]!)).toEqual([
      'src/main/shortcut.ts'
    ])
  })

  it('catches a runtime call site but not a comment or a test', () => {
    const sources: Record<string, string> = {
      'src/main/new-feature.ts': "await net.fetch('https://www.onorca.dev/v1/feedback')",
      'src/main/commented.ts': '// used to call https://onorca.dev/plugins/stats.json',
      'src/main/new-feature.test.ts': "fetch('https://push.onorca.dev')",
      'src/main/posthog.ts': "const host = 'https://us.i.posthog.com'",
      'src/main/allowed-domain.ts': "const host = 'https://notorca.dev'",
      'src/renderer/issue-link.tsx': '<a href="https://github.com/stablyai/orca/issues">',
      'src/cli/example.ts': "'orca project setups --project github:stablyai/orca'"
    }
    expect(findUpstreamRuntimeMentions(Object.keys(sources), (file) => sources[file]!)).toEqual([
      "src/main/new-feature.ts:1 onorca.dev: await net.fetch('https://www.onorca.dev/v1/feedback')",
      "src/main/posthog.ts:1 PostHog: const host = 'https://us.i.posthog.com'",
      'src/renderer/issue-link.tsx:1 GitHub stablyai: <a href="https://github.com/stablyai/orca/issues">',
      "src/cli/example.ts:1 GitHub stablyai: 'orca project setups --project github:stablyai/orca'"
    ])
  })
})
