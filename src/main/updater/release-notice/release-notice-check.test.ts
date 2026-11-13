import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLatestRelease,
  isReleaseNoticeCheckDue,
  readReleaseNotice,
  skipReleaseNoticeVersion,
  type ReleaseNoticeCheckDeps,
  type ReleaseNoticeFetch
} from './release-notice-check'

type FakeResponse = Awaited<ReturnType<ReleaseNoticeFetch>>

function response(status: number, body: unknown, etag: string | null = null): FakeResponse {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? etag : null) },
    json: () => Promise.resolve(body)
  }
}

describe('release notice check', () => {
  let dir: string
  let fetch: ReturnType<typeof vi.fn<ReleaseNoticeFetch>>
  let now: number
  let deps: ReleaseNoticeCheckDeps

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'release-notice-'))
    fetch = vi.fn<ReleaseNoticeFetch>()
    now = 1_800_000_000_000
    deps = {
      repo: 'example/app',
      currentVersion: '1.4.0',
      stateFilePath: join(dir, 'release-notice.json'),
      fetch,
      now: () => now
    }
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('asks the public releases API without credentials and reports a newer release', async () => {
    fetch.mockResolvedValue(response(200, { tag_name: 'v1.5.0' }, 'W/"abc"'))

    const result = await checkLatestRelease(deps)

    expect(result).toEqual({
      notice: { version: '1.5.0', url: 'https://github.com/example/app/releases/tag/v1.5.0' },
      answered: true
    })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.github.com/repos/example/app/releases/latest')
    expect(Object.keys(init.headers).sort()).toEqual(['Accept', 'X-GitHub-Api-Version'])
  })

  it('sends the stored ETag and keeps the notice on 304', async () => {
    fetch.mockResolvedValueOnce(response(200, { tag_name: 'v1.5.0' }, 'W/"abc"'))
    await checkLatestRelease(deps)
    fetch.mockResolvedValueOnce(response(304, null))

    const result = await checkLatestRelease(deps)

    expect(fetch.mock.calls[1]![1].headers['If-None-Match']).toBe('W/"abc"')
    expect(result.notice?.version).toBe('1.5.0')
    expect(result.answered).toBe(true)
  })

  it('shows nothing when the latest release is this version or older', async () => {
    fetch.mockResolvedValue(response(200, { tag_name: 'v1.4.0' }))
    expect((await checkLatestRelease(deps)).notice).toBeNull()
    fetch.mockResolvedValue(response(200, { tag_name: 'v1.3.9' }))
    expect((await checkLatestRelease(deps)).notice).toBeNull()
  })

  it('does not offer a local build the release it was built from', async () => {
    const local = { ...deps, currentVersion: '1.5.0-local.1762900000000.3e251dc46ec0' }
    fetch.mockResolvedValue(response(200, { tag_name: 'v1.5.0' }))
    expect((await checkLatestRelease(local)).notice).toBeNull()
    fetch.mockResolvedValue(response(200, { tag_name: 'v1.5.1' }))
    expect((await checkLatestRelease(local)).notice?.version).toBe('1.5.1')
  })

  it('ignores prereleases, drafts and tags that are not versions', async () => {
    for (const body of [
      { tag_name: 'v1.5.0-rc.1' },
      { tag_name: 'v1.5.0', prerelease: true },
      { tag_name: 'v1.5.0', draft: true },
      { tag_name: 'nightly' },
      'not an object'
    ]) {
      fetch.mockResolvedValueOnce(response(200, body))
      expect((await checkLatestRelease(deps)).notice).toBeNull()
    }
  })

  it('fails silently and keeps the last answer when GitHub is unreachable or refuses', async () => {
    fetch.mockResolvedValueOnce(response(200, { tag_name: 'v1.5.0' }, 'W/"abc"'))
    await checkLatestRelease(deps)
    const stored = readFileSync(deps.stateFilePath, 'utf8')

    fetch.mockRejectedValueOnce(new Error('net::ERR_INTERNET_DISCONNECTED'))
    expect(await checkLatestRelease(deps)).toEqual({
      notice: { version: '1.5.0', url: 'https://github.com/example/app/releases/tag/v1.5.0' },
      answered: false
    })
    for (const status of [403, 429, 500]) {
      fetch.mockResolvedValueOnce(response(status, { message: 'no' }))
      const refused = await checkLatestRelease(deps)
      expect(refused.answered).toBe(false)
      expect(refused.noRelease).toBeUndefined()
    }
    // A 404 is no release to compare with: it must never read as "up to date", and it is not a
    // connection problem either.
    fetch.mockResolvedValueOnce(response(404, { message: 'Not Found' }))
    const missing = await checkLatestRelease(deps)
    expect(missing.answered).toBe(false)
    expect(missing.noRelease).toBe(true)
    expect(readFileSync(deps.stateFilePath, 'utf8')).toBe(stored)
  })

  it('hides a skipped version but shows the release after it', async () => {
    fetch.mockResolvedValueOnce(response(200, { tag_name: 'v1.5.0' }))
    await checkLatestRelease(deps)
    skipReleaseNoticeVersion(deps, '1.5.0')
    expect(readReleaseNotice(deps)).toBeNull()

    fetch.mockResolvedValueOnce(response(200, { tag_name: 'v1.5.1' }))
    expect((await checkLatestRelease(deps)).notice?.version).toBe('1.5.1')
  })

  it('is due on first run and again a day after an answered check', async () => {
    expect(isReleaseNoticeCheckDue(deps)).toBe(true)
    fetch.mockResolvedValueOnce(response(200, { tag_name: 'v1.4.0' }))
    await checkLatestRelease(deps)
    expect(isReleaseNoticeCheckDue(deps)).toBe(false)
    now += 23 * 60 * 60_000
    expect(isReleaseNoticeCheckDue(deps)).toBe(false)
    now += 60 * 60_000
    expect(isReleaseNoticeCheckDue(deps)).toBe(true)
  })
})
