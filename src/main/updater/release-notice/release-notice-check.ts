import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import {
  RELEASE_NOTICE_CHECK_INTERVAL_MS,
  latestReleaseApiUrl,
  releaseNoticeForTag,
  releaseTagFromLatestResponse,
  type ReleaseNotice
} from '../../../shared/release-notice'

const FETCH_TIMEOUT_MS = 8000

const StateSchema = z.object({
  /** ETag of the last 200 response, sent back so an unchanged release costs GitHub a 304. */
  etag: z.string().max(256).nullable().default(null),
  latestTag: z.string().max(128).nullable().default(null),
  checkedAt: z.number().nonnegative().default(0),
  skippedVersion: z.string().max(128).nullable().default(null)
})
type ReleaseNoticeState = z.infer<typeof StateSchema>

export type ReleaseNoticeFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<{
  status: number
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
}>

export type ReleaseNoticeCheckDeps = {
  repo: string
  currentVersion: string
  stateFilePath: string
  fetch: ReleaseNoticeFetch
  now?: () => number
}

export function releaseNoticeStateFilePath(userDataPath: string): string {
  return join(userDataPath, 'release-notice.json')
}

function readState(path: string): ReleaseNoticeState {
  try {
    return StateSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return StateSchema.parse({})
  }
}

function writeState(path: string, state: ReleaseNoticeState): void {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(state))
  } catch {
    // The notice is a convenience: an unwritable profile only costs a repeat check.
  }
}

function noticeFromState(
  deps: ReleaseNoticeCheckDeps,
  state: ReleaseNoticeState
): ReleaseNotice | null {
  return releaseNoticeForTag({
    repo: deps.repo,
    tag: state.latestTag,
    currentVersion: deps.currentVersion,
    skippedVersion: state.skippedVersion
  })
}

/** The notice the last check found, without a request. */
export function readReleaseNotice(deps: ReleaseNoticeCheckDeps): ReleaseNotice | null {
  return noticeFromState(deps, readState(deps.stateFilePath))
}

/** True when the last answered check is older than a day. */
export function isReleaseNoticeCheckDue(deps: ReleaseNoticeCheckDeps): boolean {
  const now = (deps.now ?? Date.now)()
  const { checkedAt } = readState(deps.stateFilePath)
  return checkedAt <= 0 || checkedAt > now || now - checkedAt >= RELEASE_NOTICE_CHECK_INTERVAL_MS
}

export type ReleaseNoticeCheckResult = {
  notice: ReleaseNotice | null
  /** False when GitHub did not answer with a release (offline, rate limit, 404, any error). */
  answered: boolean
  /** GitHub answered that there is no release to read (404): not a connection problem. */
  noRelease?: true
}

/**
 * Asks GitHub for the latest release. Never throws: offline, a rate limit, a private or missing
 * repository and a malformed body all keep the previous answer.
 */
export async function checkLatestRelease(
  deps: ReleaseNoticeCheckDeps
): Promise<ReleaseNoticeCheckResult> {
  const state = readState(deps.stateFilePath)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (state.etag) {
    headers['If-None-Match'] = state.etag
  }
  try {
    const response = await deps.fetch(latestReleaseApiUrl(deps.repo), {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    const now = (deps.now ?? Date.now)()
    if (response.status === 304) {
      const next = { ...state, checkedAt: now }
      writeState(deps.stateFilePath, next)
      return { notice: noticeFromState(deps, next), answered: true }
    }
    // Only a release GitHub returned (200, or 304 for the one already seen) is an answer. A 404
    // means the releases cannot be read (no public release, a private or renamed repository),
    // which says nothing about this version being the latest.
    if (response.status !== 200) {
      const result: ReleaseNoticeCheckResult = {
        notice: noticeFromState(deps, state),
        answered: false
      }
      return response.status === 404 ? { ...result, noRelease: true } : result
    }
    const next: ReleaseNoticeState = {
      ...state,
      etag: response.headers.get('etag'),
      latestTag: releaseTagFromLatestResponse(await response.json()),
      checkedAt: now
    }
    writeState(deps.stateFilePath, next)
    return { notice: noticeFromState(deps, next), answered: true }
  } catch {
    return { notice: noticeFromState(deps, state), answered: false }
  }
}

/** "Skip this version": that release never shows again; a later one does. */
export function skipReleaseNoticeVersion(deps: ReleaseNoticeCheckDeps, version: string): void {
  writeState(deps.stateFilePath, { ...readState(deps.stateFilePath), skippedVersion: version })
}
