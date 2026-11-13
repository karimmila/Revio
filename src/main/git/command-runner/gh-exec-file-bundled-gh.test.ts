import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('child_process', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  spawn: spawnMock
}))

import { fakeSpawnDispatch } from '../../../shared/__fixtures__/fake-spawned-child'
import { _resetGhRateLimitBreaker } from '../gh-rate-limit-breaker'
import { _resetBundledGhForTests } from './bundled-gh-path'
import { ghExecFileAsync } from './gh-exec-file'
import { getGithubAppAuthProvider, setGithubAppAuthProvider } from './github-app-auth'

const BUNDLED = '/Applications/App.app/Contents/Resources/gh/gh'
const original = getGithubAppAuthProvider()

function missing(): Error {
  return Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT', syscall: 'spawn gh' })
}

function spawnedBinaries(): string[] {
  return spawnMock.mock.calls.map((call) => String(call[0]))
}

beforeEach(() => {
  spawnMock.mockReset()
  setGithubAppAuthProvider({
    host: () => 'github.com',
    login: () => 'octo',
    token: async () => 'ghu_app_token_value',
    peekToken: () => 'ghu_app_token_value',
    coverage: async () => 'covered'
  })
})

afterEach(() => {
  setGithubAppAuthProvider(original)
  _resetGhRateLimitBreaker()
  _resetBundledGhForTests()
})

describe.skipIf(process.platform === 'win32')('gh missing from PATH', () => {
  it('runs the gh inside the app bundle, and goes straight to it afterwards', async () => {
    _resetBundledGhForTests(BUNDLED)
    spawnMock.mockImplementation(
      fakeSpawnDispatch((binary) =>
        binary === 'gh' ? { spawnError: missing() } : { stdout: '[]' }
      )
    )

    await expect(ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])).resolves.toEqual({
      stdout: '[]',
      stderr: ''
    })
    await ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])

    expect(spawnedBinaries()).toEqual(['gh', BUNDLED, BUNDLED])
  })

  it('keeps using the gh on PATH when there is one', async () => {
    _resetBundledGhForTests(BUNDLED)
    spawnMock.mockImplementation(fakeSpawnDispatch(() => ({ stdout: '[]' })))

    await ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])
    await ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])

    expect(spawnedBinaries()).toEqual(['gh', 'gh'])
  })

  it('fails with the spawn error when the build carries no gh either', async () => {
    _resetBundledGhForTests(null)
    spawnMock.mockImplementation(fakeSpawnDispatch(() => ({ spawnError: missing() })))

    await expect(ghExecFileAsync(['pr', 'list', '--repo', 'acme/widgets'])).rejects.toMatchObject({
      code: 'ENOENT'
    })
    expect(spawnedBinaries()).toEqual(['gh'])
  })
})

describe('GitHub secondary rate limit', () => {
  it('stops sending after a 429 instead of retrying into the limit', async () => {
    spawnMock.mockImplementation(
      fakeSpawnDispatch(() => ({
        code: 1,
        stderr: 'gh: You have exceeded a secondary rate limit. (HTTP 429)'
      }))
    )

    await expect(ghExecFileAsync(['api', 'repos/acme/widgets/pulls'])).rejects.toThrow(
      /rate limit exceeded \(core\); retrying in ~\d+s/
    )
    await expect(ghExecFileAsync(['api', 'repos/acme/widgets/issues'])).rejects.toThrow(
      /retrying in ~\d+s without spawning gh/
    )

    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
