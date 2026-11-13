/**
 * The repository a gh call targets, when argv names it: `--repo`/`-R`, a `repos/OWNER/REPO` API
 * path, or GraphQL `owner=`/`repo=` (or `name=`) fields. Calls that rely on the cwd's remote return
 * null; the app token still limits them to repositories the app can reach.
 */
export type GhArgsRepository = { host: string | null; owner: string; name: string }

const REPO_FLAGS = new Set(['--repo', '-R'])
const FIELD_FLAGS = new Set(['-f', '-F', '--field', '--raw-field'])
const API_REPO_PATH = /^\/?repos\/([^/?#\s]+)\/([^/?#\s]+)/

function fromRepoValue(value: string | undefined): GhArgsRepository | null {
  const parts = value?.trim().split('/')
  if (!parts || !parts.every(Boolean)) {
    return null
  }
  if (parts.length === 2) {
    return { host: null, owner: parts[0], name: parts[1] }
  }
  if (parts.length === 3) {
    return { host: parts[0].toLowerCase(), owner: parts[1], name: parts[2] }
  }
  return null
}

function repoFlagValue(args: readonly string[], i: number): string | undefined {
  const arg = args[i]
  if (REPO_FLAGS.has(arg)) {
    return args[i + 1]
  }
  if (arg.startsWith('--repo=')) {
    return arg.slice('--repo='.length)
  }
  if (arg.startsWith('-R=')) {
    return arg.slice('-R='.length)
  }
  return undefined
}

function graphqlRepository(args: readonly string[]): GhArgsRepository | null {
  const fields = new Map<string, string>()
  for (let i = 0; i < args.length - 1; i += 1) {
    if (!FIELD_FLAGS.has(args[i])) {
      continue
    }
    const field = args[i + 1]
    const eq = field.indexOf('=')
    if (eq > 0) {
      fields.set(field.slice(0, eq), field.slice(eq + 1))
    }
  }
  const owner = fields.get('owner')
  const name = fields.get('repo') ?? fields.get('name')
  return owner && name ? { host: null, owner, name } : null
}

export function ghArgsRepository(args: readonly string[]): GhArgsRepository | null {
  for (let i = 0; i < args.length; i += 1) {
    const repo = fromRepoValue(repoFlagValue(args, i))
    if (repo) {
      return repo
    }
  }
  if (args[0] !== 'api') {
    return null
  }
  if (args.includes('graphql')) {
    return graphqlRepository(args)
  }
  for (const arg of args.slice(1)) {
    const match = API_REPO_PATH.exec(arg)
    if (match) {
      return { host: null, owner: match[1], name: match[2] }
    }
  }
  return null
}
