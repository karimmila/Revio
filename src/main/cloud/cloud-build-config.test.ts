import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLOUD_BASE_LAYER_VERSION,
  cloudBuildPredatesBaseLayer,
  currentSnapshot,
  type CloudBuild
} from '../../shared/cloud/cloud-types'
import { parseGithubRemote, remoteBranchOfRef } from './cloud-github'
import {
  appendBuildLog,
  buildLogFile,
  readBuildLog,
  readRepoFile,
  saveCloudBuild,
  setCloudDataRoot,
  writeCloudRepoConfig
} from './cloud-repo-store'

function build(id: string, startedAt: number, patch: Partial<CloudBuild> = {}): CloudBuild {
  return {
    id,
    state: 'succeeded',
    step: 'Ready',
    startedAt,
    finishedAt: startedAt + 1,
    commit: 'abc',
    snapshotId: `snap_${id}`,
    error: null,
    ...patch
  }
}

describe('cloud builds', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-cloud-'))
    setCloudDataRoot(() => root)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('keeps the base layer a build was made on, and calls a build without one older', () => {
    saveCloudBuild('repo', build('old', 1))
    saveCloudBuild('repo', build('new', 2, { baseLayer: CLOUD_BASE_LAYER_VERSION }))
    const [newest, oldest] = readRepoFile('repo').builds
    expect(newest.baseLayer).toBe(CLOUD_BASE_LAYER_VERSION)
    expect(cloudBuildPredatesBaseLayer(newest)).toBe(false)
    expect(oldest.baseLayer).toBeUndefined()
    expect(cloudBuildPredatesBaseLayer(oldest)).toBe(true)
    expect(cloudBuildPredatesBaseLayer({ baseLayer: CLOUD_BASE_LAYER_VERSION - 1 })).toBe(true)
  })

  it('reads GitHub owner and name from every remote form', () => {
    for (const url of [
      'https://github.com/acme/web-app.git',
      'git@github.com:acme/web-app.git',
      'ssh://git@github.com/acme/web-app',
      'https://github.com/acme/web-app/'
    ]) {
      expect(parseGithubRemote(url)).toEqual({ owner: 'acme', name: 'web-app' })
    }
    expect(parseGithubRemote('https://gitlab.com/acme/web-app.git')).toBeNull()
  })

  it('reads the remote branch from either base ref form', () => {
    expect(remoteBranchOfRef('refs/heads/main')).toBe('main')
    expect(remoteBranchOfRef('origin/release/1.2')).toBe('release/1.2')
    expect(remoteBranchOfRef('main')).toBeNull()
    expect(remoteBranchOfRef(undefined)).toBeNull()
  })

  it('keeps scripts and the newest builds per repository, privately', () => {
    writeCloudRepoConfig('repo-1', {
      installScript: 'pnpm install',
      setupScript: '',
      wakeScript: '',
      vcpus: 2
    })
    for (let index = 0; index < 12; index += 1) {
      saveCloudBuild('repo-1', build(`b${index}`, index))
    }
    saveCloudBuild('repo-1', build('b11', 11, { state: 'failed', snapshotId: null }))
    const file = readRepoFile('repo-1')
    expect(file.config.installScript).toBe('pnpm install')
    expect(file.builds).toHaveLength(10)
    expect(file.builds[0]?.id).toBe('b11')
    expect(currentSnapshot(file)?.id).toBe('b10')
    expect(statSync(join(root, 'repos', 'repo-1.json')).mode & 0o077).toBe(0)
    appendBuildLog('b1', 'hello\n')
    expect(readBuildLog('b1')).toBe('hello\n')
    expect(() => buildLogFile('../escape')).toThrow()
    expect(() => readRepoFile('../escape')).toThrow()
  })
})
