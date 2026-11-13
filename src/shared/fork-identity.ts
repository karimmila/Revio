import forkIdentityJson from './fork-identity.json'

/*
 * Packaged identity of this fork. fork-identity.json is the only place to change it:
 * config/electron-builder.config.cjs and electron.vite.config.ts read the same file.
 * Dev builds keep upstream's ids (com.stablyai.orca.dev, the orca-dev profile) on purpose,
 * so a running dev instance and its data are never moved.
 *
 * Renaming productName does not move user data: userDataDirName is separate so a rename
 * keeps everyone's settings and sessions.
 */
export type ForkIdentity = {
  productName: string
  appId: string
  userDataDirName: string
  /** The URL scheme the packaged app registers and writes into links it creates. */
  urlScheme: string
  /** The shell command the packaged app installs (/usr/local/bin/<name>, ~/.local/bin/<name>). */
  cliCommandName: string
  /** Shown in About above copyrightNotice, so the upstream credit reads before the notice. */
  basedOnNotice: string
  copyrightNotice: string
  /** "owner/repo" of the GitHub releases the packaged app updates from; null turns the updater off. */
  updateFeedGitHubRepo: string | null
  /** This fork's public source repository: bundled skills install from it, and it names the app to sites it fetches. */
  sourceRepoUrl: string
  /**
   * "owner/repo" whose public GitHub releases the app reads to say "a new version is available"
   * (one unauthenticated GET a day; see src/shared/release-notice.ts). It never downloads or
   * installs; null turns the notice off.
   */
  releasesRepo: string | null
  /**
   * The GitHub App cloud workspaces sign in with (device flow, no client secret). "TBD" means it
   * is not registered yet; Settings > Advanced can point at another app or a GHES host.
   */
  githubApp: { clientId: string; slug: string; host: string }
  /**
   * Hosted services this build talks to. Every value is null by default: a null service is off,
   * makes no request and hides its UI. Read them only through src/shared/fork-services.ts.
   */
  services: ForkServices
}

export type ForkServices = {
  /** POST endpoint for "Send Feedback" and crash reports. */
  feedbackUrl: string | null
  /** Page that "Report an issue" opens, e.g. a GitHub new-issue URL. */
  issuesUrl: string | null
  /** Account sign-in API that cloud features (relay, connectors, sharing) authenticate with. */
  cloudLoginUrl: string | null
  /** Mobile relay director; null hides mobile pairing and remote access. */
  relayBaseUrl: string | null
  /** Phone push gateway. */
  pushGatewayUrl: string | null
  /** Hosted connector service. */
  connectorUrl: string | null
  /** Artifact and skill share API origin. */
  shareBaseUrl: string | null
  /** Web origin whose /skills/share/<id> links open skill shares. */
  skillShareUrl: string | null
  /** Git URL of the official plugin catalog. */
  pluginCatalogUrl: string | null
  /** Git URL of the community plugin catalog. */
  communityPluginCatalogUrl: string | null
  /** Web plugin directory; its /stats.json and /kill-list.json feed install counts and the safety list. */
  pluginDirectoryUrl: string | null
  /** Origin that serves whats-new/changelog.json, whats-new/nudge.json and the changelog page. */
  whatsNewUrl: string | null
  /** Base URL that "Learn more" doc paths such as /docs/terminal resolve against. */
  docsBaseUrl: string | null
  /** Product analytics write key. Telemetry cannot transmit without it. */
  telemetryWriteKey: string | null
  /** Token endpoint for diagnostic log uploads. */
  diagnosticsUploadUrl: string | null
}

export const FORK_IDENTITY: ForkIdentity = forkIdentityJson
export const FORK_PRODUCT_NAME = FORK_IDENTITY.productName
export const FORK_APP_ID = FORK_IDENTITY.appId
export const FORK_USER_DATA_DIR_NAME = FORK_IDENTITY.userDataDirName
export const FORK_URL_SCHEME = FORK_IDENTITY.urlScheme
/**
 * The app's visible folder in the home directory (~/revio/workspaces, ~/revio/projects,
 * ~/revio/cloud-mirrors) and, with a leading dot, its config folder (~/.revio). Upstream uses
 * LEGACY_HOME_FOLDER_NAME for both, so sharing the name would share the folders with a real
 * install of it. Profiles that already point at the old folders keep them.
 */
export const FORK_HOME_FOLDER_NAME = FORK_IDENTITY.userDataDirName
export const LEGACY_HOME_FOLDER_NAME = 'orca'
export const FORK_CLI_COMMAND_NAME = FORK_IDENTITY.cliCommandName
export const FORK_SOURCE_REPO_URL = FORK_IDENTITY.sourceRepoUrl
/**
 * Names of the macOS helper bundles the app ships. They show in the Accessibility and Screen
 * Recording lists and in Activity Monitor. config/scripts build the bundles under the same names.
 */
export const FORK_COMPUTER_USE_HELPER_NAME = `${FORK_PRODUCT_NAME} Computer Use`
export const FORK_TERMINAL_HOST_HELPER_NAME = `${FORK_PRODUCT_NAME} Terminal Host`
/** Prefix for the packaged app's launchd labels; dev builds keep upstream's com.stablyai.orca. */
export const FORK_LAUNCHD_LABEL_PREFIX = FORK_IDENTITY.appId

/**
 * Links this app reads: its own scheme, plus `orca:` so links pasted from older builds, docs or
 * the plugin directory still parse. The OS only routes the registered scheme to this app.
 */
export function isAppLinkProtocol(protocol: string): boolean {
  return protocol === `${FORK_URL_SCHEME}:` || protocol === 'orca:'
}

export function isAppLinkText(value: string): boolean {
  const lower = value.trim().toLowerCase()
  return lower.startsWith(`${FORK_URL_SCHEME}:`) || lower.startsWith('orca:')
}

/**
 * Command specs, examples and receipts are written as `orca …` (upstream's name, which this app
 * still answers to as a hidden alias); shown to people and agents they name this app's command.
 */
export function withForkCliCommandName(command: string): string {
  return command.replace(/^orca(?=\s|$)/, FORK_CLI_COMMAND_NAME)
}
