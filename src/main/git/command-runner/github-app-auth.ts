import { addWslEnvKeys } from '../../../shared/wsl-env'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

/**
 * Every GitHub request Revio makes on this Mac carries the Revio GitHub App user token, never the
 * person's own `gh` login. With the login keychain locked, each `gh` that reads its own credential
 * runs `security find-generic-password -s gh:github.com`, and polling turned that into hundreds of
 * password dialogs. gh reads GH_TOKEN (github.com) or GH_ENTERPRISE_TOKEN (other hosts) before it
 * looks at its keyring, and `gh auth …` is the only family that reads the keyring regardless, so
 * that family is refused here outright.
 *
 * The provider lives in the cloud module (it owns the sealed session); the runner only sees this
 * interface so it stays free of Electron imports and is easy to fake in tests.
 */
export type GithubAppAuthProvider = {
  /** Host of the configured app, lower case; null when no app is configured. */
  host(): string | null
  /** A live token, refreshed ahead of expiry. Throws when signed out or expired. */
  token(): Promise<string>
  /** The signed-in GitHub login; null when signed out. */
  login(): string | null
  /** The token already in memory, without a refresh; null when there is none. */
  peekToken(): string | null
  /** Whether the app can reach this repository; 'unknown' when coverage could not be read. */
  coverage(owner: string, name: string): Promise<'covered' | 'not-covered' | 'unknown'>
}

// A global slot, like the secret store's: it survives vi.resetModules, so a re-imported runner
// still sees the provider main (or the unit-test setup) installed.
const SLOT = Symbol.for('orca.host.githubAppAuthProvider')

export function setGithubAppAuthProvider(next: GithubAppAuthProvider | null): void {
  Reflect.set(globalThis, SLOT, next)
}

function isGithubAppAuthProvider(value: unknown): value is GithubAppAuthProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    'token' in value &&
    typeof value.token === 'function' &&
    'host' in value &&
    typeof value.host === 'function'
  )
}

export function getGithubAppAuthProvider(): GithubAppAuthProvider | null {
  const stored: unknown = Object.getOwnPropertyDescriptor(globalThis, SLOT)?.value
  return isGithubAppAuthProvider(stored) ? stored : null
}

export const GITHUB_SIGN_IN_REQUIRED_CODE = 'REVIO_GITHUB_SIGN_IN_REQUIRED'
export const GITHUB_APP_NOT_INSTALLED_CODE = 'REVIO_GITHUB_APP_NOT_INSTALLED'

/** No GitHub call ran: there is no app token for the target host. */
export class GithubAppSignInRequiredError extends Error {
  readonly code = GITHUB_SIGN_IN_REQUIRED_CODE
  constructor(message = `Sign in with GitHub in ${FORK_PRODUCT_NAME} Settings > Account.`) {
    super(message)
    this.name = 'GithubAppSignInRequiredError'
  }
}

/** No GitHub call ran: the app is not installed on the repository's owner. */
export class GithubAppNotInstalledError extends Error {
  readonly code = GITHUB_APP_NOT_INSTALLED_CODE
  constructor(readonly owner: string) {
    super(`Install ${FORK_PRODUCT_NAME} on ${owner} to use GitHub features for this repository.`)
    this.name = 'GithubAppNotInstalledError'
  }
}

export function isGithubAppSignInRequired(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === GITHUB_SIGN_IN_REQUIRED_CODE
  )
}

export function githubAppNotInstalledOwner(error: unknown): string | null {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === GITHUB_APP_NOT_INSTALLED_CODE &&
    'owner' in error &&
    typeof error.owner === 'string'
  ) {
    return error.owner
  }
  return null
}

/** Env var that carries the token to git's credential helper; never in argv, never on disk. */
export const GIT_TOKEN_ENV = 'REVIO_GITHUB_APP_TOKEN'

// Git runs `!` helpers through sh with the action appended. It answers only "get", so a "store"
// from git never writes the token anywhere.
const CREDENTIAL_HELPER = `!f() { test "$1" = get || exit 0; echo username=x-access-token; echo "password=$${GIT_TOKEN_ENV}"; }; f`

/**
 * Git config entries, passed through GIT_CONFIG_COUNT so they never appear in argv, that clear
 * every credential helper for the app host (osxkeychain and `gh auth git-credential` both read the
 * keychain) and, with a token, add one that answers from the environment.
 */
export function githubCredentialGitEnv(
  env: NodeJS.ProcessEnv,
  host: string,
  token: string | null,
  options: { wsl?: boolean } = {}
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env }
  const existing = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10)
  let index = Number.isFinite(existing) && existing > 0 ? existing : 0
  const key = `credential.https://${host}.helper`
  const add = (value: string): void => {
    next[`GIT_CONFIG_KEY_${index}`] = key
    next[`GIT_CONFIG_VALUE_${index}`] = value
    index += 1
  }
  add('')
  if (token) {
    add(CREDENTIAL_HELPER)
    next[GIT_TOKEN_ENV] = token
  } else {
    delete next[GIT_TOKEN_ENV]
  }
  next.GIT_CONFIG_COUNT = String(index)
  next.GIT_TERMINAL_PROMPT = '0'
  if (options.wsl) {
    const keys = ['GIT_CONFIG_COUNT', 'GIT_TERMINAL_PROMPT']
    for (let i = 0; i < index; i += 1) {
      keys.push(`GIT_CONFIG_KEY_${i}`, `GIT_CONFIG_VALUE_${i}`)
    }
    if (token) {
      keys.push(GIT_TOKEN_ENV)
    }
    addWslEnvKeys(next, keys)
  }
  return next
}

/**
 * For network git: the app host's helpers are replaced; other hosts' remotes are untouched. Before
 * the provider is registered (plain-Node hosts, unit tests) the env passes through unchanged.
 */
export function withGithubAppGitCredentials(
  env: NodeJS.ProcessEnv,
  options: { wsl?: boolean } = {}
): NodeJS.ProcessEnv {
  const provider = getGithubAppAuthProvider()
  if (!provider) {
    return env
  }
  const host = provider.host() ?? 'github.com'
  return githubCredentialGitEnv(env, host, provider.peekToken(), options)
}

/** Refreshes the token before a network git command when it is close to expiry; never throws. */
export async function refreshGithubAppTokenForGit(): Promise<void> {
  await getGithubAppAuthProvider()
    ?.token()
    .catch(() => undefined)
}

const TOKEN_ENV_KEYS = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'GH_HOST'
]

/** The gh child env: the app token for its host, prompts off, no inherited token to fall back to. */
export function githubAppGhEnv(
  env: NodeJS.ProcessEnv,
  host: string,
  token: string,
  options: { wsl?: boolean } = {}
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env }
  for (const key of TOKEN_ENV_KEYS) {
    delete next[key]
  }
  next.GH_HOST = host
  if (host === 'github.com') {
    next.GH_TOKEN = token
  } else {
    // GHES reads GH_ENTERPRISE_TOKEN; *.ghe.com tenancies read GH_TOKEN.
    next.GH_ENTERPRISE_TOKEN = token
    next.GH_TOKEN = token
  }
  next.GH_PROMPT_DISABLED = '1'
  next.GH_NO_UPDATE_NOTIFIER = '1'
  const withGit = githubCredentialGitEnv(next, host, token, options)
  if (options.wsl) {
    addWslEnvKeys(withGit, ['GH_HOST', 'GH_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GH_PROMPT_DISABLED'])
  }
  return withGit
}
