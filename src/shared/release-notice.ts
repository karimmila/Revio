import { compareAppVersions, isPrereleaseAppVersion, isValidAppVersion } from './app-version'
import { FORK_IDENTITY } from './fork-identity'
import { parseUpdateFeedRepo } from './update-feed'

/*
 * The packaged app cannot update itself (ad-hoc signed, no update feed), so it only says that a
 * newer release exists and opens its page. The one request this makes is a public, unauthenticated
 * GET of the releases API for fork-identity.json `releasesRepo`; it sends no user data.
 */
export type ReleaseNotice = {
  /** The newer version, without a leading "v". */
  version: string
  /** The release page on github.com, built from releasesRepo and the tag, never from the response. */
  url: string
}

export const RELEASE_NOTICE_CHECK_INTERVAL_MS = 24 * 60 * 60_000

/** The "owner/repo" release notices come from; null when this build names none. */
export function releaseNoticeRepo(
  identity: { releasesRepo: string | null } = FORK_IDENTITY
): string | null {
  return parseUpdateFeedRepo(identity.releasesRepo)
}

export function latestReleaseApiUrl(repo: string): string {
  return `https://api.github.com/repos/${repo}/releases/latest`
}

/** Every release of this app, for "Open releases page". */
export function releasesPageUrl(repo: string): string {
  return `https://github.com/${repo}/releases`
}

function releasePageUrl(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`
}

/** Reads the tag of a "latest release" response; null for drafts, prereleases and odd shapes. */
export function releaseTagFromLatestResponse(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const tag = 'tag_name' in payload ? payload.tag_name : null
  if (typeof tag !== 'string' || !isValidAppVersion(tag) || isPrereleaseAppVersion(tag)) {
    return null
  }
  if (
    ('draft' in payload && payload.draft === true) ||
    ('prerelease' in payload && payload.prerelease === true)
  ) {
    return null
  }
  return tag
}

/** The notice to show for a release tag, or null when it is not newer, or the person skipped it. */
export function releaseNoticeForTag(args: {
  repo: string
  tag: string | null
  currentVersion: string
  skippedVersion: string | null
}): ReleaseNotice | null {
  const { repo, tag, skippedVersion } = args
  // A local build is stamped "0.1.0-local.<time>.<commit>": the same code line as 0.1.0, not an
  // older prerelease of it, so it must not be told that 0.1.0 is available.
  const currentVersion = args.currentVersion.replace(/-local\.[0-9A-Za-z.-]+$/, '')
  if (!tag || !isValidAppVersion(tag) || !isValidAppVersion(currentVersion)) {
    return null
  }
  if (compareAppVersions(tag, currentVersion) <= 0) {
    return null
  }
  const version = tag.trim().replace(/^v/i, '')
  if (skippedVersion && compareAppVersions(tag, skippedVersion) === 0) {
    return null
  }
  return { version, url: releasePageUrl(repo, tag.trim()) }
}
