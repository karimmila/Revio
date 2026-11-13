import { describe, expect, it } from 'vitest'
import type { CloudRepoReadiness } from '../../../shared/cloud/cloud-types'
import { cloudCreateBlock, isCloudCapableRepo, orderCloudRepos } from './cloud-create-guard'

function repo(
  id: string,
  kind: 'git' | 'folder',
  remoteUrl: string | null,
  host: 'local' | `runtime:${string}` = 'local'
) {
  return {
    id,
    displayName: id,
    kind,
    connectionId: null,
    executionHostId: host,
    gitRemoteIdentity: remoteUrl ? { canonicalKey: id, remoteName: 'origin', remoteUrl } : null
  }
}

const home = repo('~', 'folder', null)
const monorepo = repo('monorepo', 'git', 'https://github.com/acme-corp/monorepo.git')
const cloudTest = repo('sample-app', 'git', 'git@github.com:octo-dev/sample-app.git')
const gitlab = repo('elsewhere', 'git', 'https://gitlab.com/acme/elsewhere.git')
const sandboxCopy = repo('sandbox', 'git', 'https://github.com/acme/app.git', 'runtime:env-1')

function readiness(
  entries: [string, CloudRepoReadiness['blocked']][]
): ReadonlyMap<string, CloudRepoReadiness> {
  return new Map(
    entries.map(([repoId, blocked]) => [
      repoId,
      { repoId, owner: 'o', name: repoId, builtAt: blocked ? null : 1, building: false, blocked }
    ])
  )
}

describe('cloud-capable repositories', () => {
  it('takes Git repositories on this Mac with a GitHub origin, never "~" or other folders', () => {
    expect(isCloudCapableRepo(home)).toBe(false)
    expect(isCloudCapableRepo(gitlab)).toBe(false)
    expect(isCloudCapableRepo(sandboxCopy)).toBe(false)
    expect(isCloudCapableRepo(monorepo)).toBe(true)
    expect(isCloudCapableRepo(cloudTest)).toBe(true)
  })

  it('prefers a repository that only needs a build over one that needs GitHub', () => {
    const state = readiness([
      ['sample-app', { reason: 'Connect GitHub', action: 'connect-github' }],
      ['monorepo', { reason: 'Build it', action: 'build' }]
    ])
    expect(orderCloudRepos([cloudTest, monorepo], state, null).map((entry) => entry.id)).toEqual([
      'monorepo',
      'sample-app'
    ])
  })

  it('lists the last used first, then ready ones, and drops the rest of the projects', () => {
    const ready = readiness([
      ['monorepo', { reason: 'Build it', action: 'build' }],
      ['sample-app', null]
    ])
    const all = [home, monorepo, gitlab, cloudTest]
    expect(orderCloudRepos(all, ready, null).map((entry) => entry.id)).toEqual([
      'sample-app',
      'monorepo'
    ])
    expect(orderCloudRepos(all, ready, 'monorepo').map((entry) => entry.id)).toEqual([
      'monorepo',
      'sample-app'
    ])
  })
})

describe('cloud create guard', () => {
  it('refuses a folder project instead of creating a Mac workspace', () => {
    expect(cloudCreateBlock(home, readiness([]))).toMatchObject({
      reason: expect.stringContaining("can't run in the cloud"),
      action: null
    })
    expect(cloudCreateBlock(null, readiness([]))?.action).toBeNull()
  })

  it('names the one step that fixes a blocked repository', () => {
    const state = readiness([
      ['monorepo', { reason: 'Connect GitHub for acme-corp…', action: 'connect-github' }]
    ])
    expect(cloudCreateBlock(monorepo, state)).toEqual({
      reason: 'Connect GitHub for acme-corp…',
      action: 'connect-github',
      repoId: 'monorepo'
    })
  })

  it('waits for the readiness check and lets a ready repository through', () => {
    expect(cloudCreateBlock(cloudTest, null)?.reason).toMatch(/Checking/)
    expect(cloudCreateBlock(cloudTest, readiness([['sample-app', null]]))).toBeNull()
  })
})
