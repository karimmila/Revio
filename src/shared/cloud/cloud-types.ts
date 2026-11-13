/** Per-repository cloud scripts, kept in Orca's data folder on this Mac. */
export type CloudRepoConfig = {
  /** Runs once per build; its result is saved in the snapshot every cloud workspace starts from. */
  installScript: string
  /** Runs in each new cloud workspace, after its branch is checked out. */
  setupScript: string
  /** Runs each time a stopped cloud workspace resumes (processes do not survive a stop). */
  wakeScript: string
  /** Null uses the plan's default. */
  vcpus: number | null
  /** Cloud workspaces' outbound network; builds always run open. */
  network?: 'open' | 'allowlist'
  /** Hosts an "allowlist" workspace may also reach, one per entry (`*.example.com` allowed). */
  extraDomains?: string[]
}

export type CloudBuildState = 'running' | 'succeeded' | 'failed' | 'canceled'

export type CloudBuild = {
  id: string
  state: CloudBuildState
  step: string
  startedAt: number
  finishedAt: number | null
  commit: string | null
  snapshotId: string | null
  error: string | null
  /** The base layer the snapshot was built on; absent on builds made before it was recorded. */
  baseLayer?: number
}

/**
 * Counts changes to what the base layer installs under every build (desktop packages, tools).
 * A build on an older layer still works: its desktop fetches what it lacks on each start.
 */
export const CLOUD_BASE_LAYER_VERSION = 2

/** True for a build whose desktop lacks tools the current base layer installs. */
export function cloudBuildPredatesBaseLayer(build: Pick<CloudBuild, 'baseLayer'>): boolean {
  return (build.baseLayer ?? 0) < CLOUD_BASE_LAYER_VERSION
}

export type CloudRepoState = {
  config: CloudRepoConfig
  /** Newest first. */
  builds: CloudBuild[]
  github: { owner: string; name: string } | null
}

export type CloudBuildEvent = {
  repoId: string
  build: CloudBuild
  /** New log text since the previous event. */
  log: string
}

export const EMPTY_CLOUD_REPO_CONFIG: CloudRepoConfig = {
  installScript: '',
  setupScript: '',
  wakeScript: '',
  vcpus: null
}

export function currentSnapshot(state: Pick<CloudRepoState, 'builds'>): CloudBuild | null {
  return state.builds.find((build) => build.state === 'succeeded' && build.snapshotId) ?? null
}

/** A cloud workspace's one-way copy on this Mac, as the workspace's sync popover shows it. */
export type CloudMirrorStatus = {
  state: 'never' | 'synced' | 'failed'
  mirrorPath: string | null
  lastSyncedAt: number | null
  error: string | null
  files: number
  deleted: number
  skippedLinks: number
  skippedLarge: number
}

export type CloudMirrorInfo = {
  /** The local repository the mirror is a worktree of. */
  repoId: string | null
  enabled: boolean
  mirrorPath: string | null
  lastSyncedAt: number | null
  error: string | null
}

/** What Orca's Vercel project holds, for Settings > Cloud. */
export type CloudInventory = {
  sandboxes: {
    name: string
    status: string
    kind: 'workspace' | 'build' | 'other'
    /** The workspace that owns it, or null when no Orca record does. */
    owner: string | null
    orphan: boolean
    createdAt: number
  }[]
  snapshots: {
    id: string
    sizeBytes: number
    createdAt: number
    /** Taken by Vercel when a persistent sandbox stopped, not by a build. */
    automatic: boolean
    /** A repository's current build starts from it. */
    referenced: boolean
  }[]
}

/** A device-flow sign-in waiting for the person to enter `userCode` on GitHub. */
export type CloudGithubSignIn = { userCode: string; verificationUri: string; expiresAt: number }

/** Whether the GitHub App reaches one of this Mac's GitHub repositories. */
export type CloudGithubRepoCoverage = {
  repoId: string
  owner: string
  name: string
  state: 'covered' | 'not-covered' | 'unknown'
  /** The app's install page, opened on this owner when GitHub told Orca its id. */
  installUrl: string | null
}

/** GitHub for cloud workspaces: one GitHub App sign-in per Mac; the tokens never leave main. */
export type CloudGithubStatus = {
  app:
    | { configured: true; host: string; slug: string; custom: boolean; authorizationsUrl: string }
    | { configured: false; message: string }
  account: { login: string } | null
  /** A refresh was refused (revoked, or six months unused): "Sign in again". */
  signInExpired: boolean
  signIn: CloudGithubSignIn | null
  repos: CloudGithubRepoCoverage[]
  /** The owner whose install page Orca opened; coverage is re-checked on focus until it lands. */
  pendingInstallOwner: string | null
  /** Why coverage could not be read (offline, GitHub down); the repos then say "unknown". */
  coverageError: string | null
  /** Fine-grained tokens from before the app were deleted: say so once. */
  migrated: boolean
}

export type CloudGithubEvent = {
  error: string | null
  /** The sign-in just expired (GitHub refused the refresh, or the token ran out unrefreshed). */
  expired?: boolean
  /** The keychain refused to unseal the stored sign-in; sent once until the person re-checks. */
  keychainRefused?: boolean
}

/** Whether one of this Mac's GitHub repositories can get a cloud workspace now, and if not why. */
export type CloudRepoReadiness = {
  repoId: string
  owner: string
  name: string
  /** Epoch ms of the build new workspaces start from; null when there is none. */
  builtAt: number | null
  building: boolean
  /** Null when a cloud workspace can be created now. */
  blocked: { reason: string; action: CloudReadinessAction } | null
}

/** The one step that unblocks a repository: Settings > Cloud (Vercel), Settings > Account (GitHub), or
 * the repository's Cloud section. */
export type CloudReadinessAction = 'connect-vercel' | 'connect-github' | 'build'

/** A sandbox port anyone with `url` can reach; Vercel picks the random subdomain. */
export type CloudPublicPort = { port: number; url: string }

/** A TCP listener in the sandbox; `loopbackOnly` when it binds 127.0.0.1 or ::1 alone. */
export type CloudListeningPort = { port: number; loopbackOnly: boolean }

export type CloudPublicPorts = { shared: CloudPublicPort[]; listening: CloudListeningPort[] }
