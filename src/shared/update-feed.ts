// Substituted at build time from fork-identity.json by electron.vite.config.ts and config/vitest.config.ts.
// Declared and read only here, like ORCA_LAYOUT_OWNER in layout-owner-switch.ts.
declare const ORCA_UPDATE_FEED_REPO: string | null | undefined

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/

export function parseUpdateFeedRepo(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return GITHUB_REPO_PATTERN.test(trimmed) ? trimmed : null
}

/** The GitHub "owner/repo" this build updates from, or null when updates are managed outside the app. */
export function getUpdateFeedRepo(): string | null {
  return parseUpdateFeedRepo(
    // oxlint-disable-next-line unicorn/no-typeof-undefined -- a build-time define; tests and the CLI run without it, where a bare reference throws
    typeof ORCA_UPDATE_FEED_REPO !== 'undefined' ? ORCA_UPDATE_FEED_REPO : null
  )
}

/**
 * Why: without a feed of its own, a packaged fork must never check, download or install,
 * because the only feed electron-updater knows is upstream's and it would replace the fork.
 */
export function isAppUpdaterEnabled(): boolean {
  return getUpdateFeedRepo() !== null
}

/** Only for code that runs after isAppUpdaterEnabled() was true; a missing feed is a bug there. */
export function requireUpdateFeedRepo(): string {
  const repo = getUpdateFeedRepo()
  if (!repo) {
    throw new Error('update_feed_not_configured')
  }
  return repo
}

export function getUpdateFeedUrls(repo: string): {
  latestDownload: string
  latestRelease: string
  releasesAtom: string
  releaseDownloadBase: string
  releaseTagPathPrefix: string
} {
  const base = `https://github.com/${repo}/releases`
  return {
    latestDownload: `${base}/latest/download`,
    latestRelease: `${base}/latest`,
    releasesAtom: `${base}.atom`,
    releaseDownloadBase: `${base}/download`,
    releaseTagPathPrefix: `/${repo}/releases/tag/`
  }
}
