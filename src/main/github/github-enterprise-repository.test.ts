import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { commandExecFileAsyncMock, ghExecFileAsyncMock, gitExecFileAsyncMock, resolveWithSshGMock } =
  vi.hoisted(() => ({
    commandExecFileAsyncMock: vi.fn(),
    ghExecFileAsyncMock: vi.fn(),
    gitExecFileAsyncMock: vi.fn(),
    resolveWithSshGMock: vi.fn()
  }))

// Mock only execution so identity, runtime and auth-status parsing remain real.
vi.mock('../git/command-runner/command-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  commandExecFileAsync: commandExecFileAsyncMock
}))

vi.mock('../git/command-runner/gh-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ghExecFileAsync: ghExecFileAsyncMock
}))

vi.mock('../git/command-runner/git-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  gitExecFileAsync: gitExecFileAsyncMock
}))

vi.mock('../ssh/config/ssh-g-config-resolution', () => ({
  resolveWithSshG: resolveWithSshGMock
}))
import {
  _resetGitHubHostAuthCache,
  getEnterpriseGitHubRepoSlug,
  isGitHubHostAuthenticated
} from './github-enterprise-repository'
import { _resetSshHostnameResolutionCache } from './github-ssh-host-alias-resolution'
import {
  getGithubAppAuthProvider,
  GithubAppSignInRequiredError,
  setGithubAppAuthProvider
} from '../git/command-runner/github-app-auth'

function mockOriginRemote(url: string): void {
  gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
    if (args[0] === 'remote' && args[1] === 'get-url') {
      return { stdout: `${url}\n`, stderr: '' }
    }
    return { stdout: '', stderr: '' }
  })
}

function mockHostAuthenticated(host = 'github.acme-corp.com'): void {
  mockAppSignedIn(host)
}

/** The GitHub App configured on `host` and signed in: the only host Revio authenticates. */
function mockAppSignedIn(host: string): void {
  setGithubAppAuthProvider({
    host: () => host,
    login: () => 'kelora',
    token: async () => 'app-token',
    peekToken: () => 'app-token',
    coverage: async () => 'covered'
  })
}

function mockAppSignedOut(host: string): void {
  setGithubAppAuthProvider({
    host: () => host,
    login: () => null,
    token: async () => {
      throw new GithubAppSignInRequiredError()
    },
    peekToken: () => null,
    coverage: async () => 'unknown'
  })
}

const signedInDefault = getGithubAppAuthProvider()
afterEach(() => setGithubAppAuthProvider(signedInDefault))

describe('getEnterpriseGitHubRepoSlug', () => {
  beforeEach(() => {
    commandExecFileAsyncMock.mockReset()
    ghExecFileAsyncMock.mockReset()
    gitExecFileAsyncMock.mockReset()
    resolveWithSshGMock.mockReset()
    resolveWithSshGMock.mockResolvedValue(null)
    _resetGitHubHostAuthCache()
    _resetSshHostnameResolutionCache()
  })

  it.each([
    'https://ghe.acme.com:8443/team/orca.git',
    'https://ghe.acme.com:80/team/orca.git',
    'http://ghe.acme.com:443/team/orca.git'
  ])('rejects portless authentication for a non-default web endpoint: %s', async (remoteUrl) => {
    mockOriginRemote(remoteUrl)
    mockHostAuthenticated('ghe.acme.com')

    await expect(getEnterpriseGitHubRepoSlug('/repo')).resolves.toBeNull()
  })

  it('leaves a signed-out answer uncached so signing in is seen on the next probe', async () => {
    mockOriginRemote('git@ghe.acme.com:team/orca.git')
    mockAppSignedOut('ghe.acme.com:8443')

    await expect(getEnterpriseGitHubRepoSlug('/repo')).resolves.toBeUndefined()

    mockHostAuthenticated('ghe.acme.com:8443')
    await expect(getEnterpriseGitHubRepoSlug('/repo')).resolves.toEqual({
      owner: 'team',
      repo: 'orca',
      host: 'ghe.acme.com:8443'
    })
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })
})

describe('isGitHubHostAuthenticated', () => {
  beforeEach(() => {
    ghExecFileAsyncMock.mockReset()
    gitExecFileAsyncMock.mockReset()
    _resetGitHubHostAuthCache()
  })

  it('is true only for the GitHub App host, and never runs gh auth status', async () => {
    mockHostAuthenticated('github.acme-corp.com')

    await expect(isGitHubHostAuthenticated('github.acme-corp.com', '/repo')).resolves.toBe(true)
    await expect(isGitHubHostAuthenticated('evil.example.test', '/repo')).resolves.toBe(false)
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('is false while signed out', async () => {
    mockAppSignedOut('github.acme-corp.com')

    await expect(isGitHubHostAuthenticated('github.acme-corp.com', '/repo')).resolves.toBe(false)
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('infers a port only from the app host', async () => {
    mockHostAuthenticated('ghe.acme.com:8443')

    await expect(isGitHubHostAuthenticated('ghe.acme.com', '/repo')).resolves.toBe(true)
  })
})
