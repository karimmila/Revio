import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  readCloudEnvironmentKeys,
  readWorkspaceVariables,
  setWorkspaceVariablesRoot,
  workspaceVariablesFile,
  writeWorkspaceVariables
} from './workspace-variables-files'
import {
  applyWorkspaceVariables,
  findRepoForPath,
  setWorkspaceVariablesRepoResolver,
  workspacePathOf
} from './workspace-variables-env'

describe('workspace variables', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-vars-'))
    setWorkspaceVariablesRoot(() => root)
    setWorkspaceVariablesRepoResolver((cwd) => (cwd.startsWith('/work/app') ? 'repo-1' : null))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('stores each scope as a private .env file and remembers cloud marks', () => {
    writeWorkspaceVariables({ kind: 'repo', repoId: 'repo-1' }, [
      { key: 'API_KEY', value: 'secret', sendToCloud: false },
      { key: 'GREETING', value: 'hi there', sendToCloud: true }
    ])
    const file = workspaceVariablesFile({ kind: 'repo', repoId: 'repo-1' })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(readFileSync(file, 'utf8')).toContain('GREETING="hi there"')
    expect(readWorkspaceVariables({ kind: 'repo', repoId: 'repo-1' })).toEqual([
      { key: 'API_KEY', value: 'secret', sendToCloud: false, cloudEnvironment: false },
      { key: 'GREETING', value: 'hi there', sendToCloud: true, cloudEnvironment: false }
    ])
  })

  it('lets only a cloud-marked variable into the sandbox environment, and only when asked', () => {
    writeWorkspaceVariables({ kind: 'global' }, [
      { key: 'NODE_ENV', value: 'development', sendToCloud: true, cloudEnvironment: true },
      { key: 'LOCAL_ONLY', value: 'x', sendToCloud: false, cloudEnvironment: true }
    ])
    writeWorkspaceVariables({ kind: 'repo', repoId: 'repo-1' }, [
      { key: 'DATABASE_URL', value: 'postgres://local', sendToCloud: true }
    ])
    expect([...readCloudEnvironmentKeys('repo-1')]).toEqual(['NODE_ENV'])
  })

  it('layers the repository over global, keeps explicit spawn keys and never sets reserved ones', () => {
    writeWorkspaceVariables({ kind: 'global' }, [
      { key: 'SHARED', value: 'global', sendToCloud: false },
      { key: 'ONLY_GLOBAL', value: 'g', sendToCloud: false }
    ])
    writeWorkspaceVariables({ kind: 'repo', repoId: 'repo-1' }, [
      { key: 'SHARED', value: 'repo', sendToCloud: false },
      { key: 'AGENT_SET', value: 'from-vars', sendToCloud: false }
    ])
    const env: Record<string, string> = { SHARED: 'shell', AGENT_SET: 'explicit', PATH: '/bin' }
    applyWorkspaceVariables(env, '/work/app/src', ['AGENT_SET'])
    expect(env).toEqual({ SHARED: 'repo', ONLY_GLOBAL: 'g', AGENT_SET: 'explicit', PATH: '/bin' })
  })

  it('never stops a spawn when the variables store is unavailable', () => {
    setWorkspaceVariablesRoot(() => {
      throw new Error('not configured')
    })
    const env: Record<string, string> = { A: '1' }
    expect(() => applyWorkspaceVariables(env, '/work/app')).not.toThrow()
    expect(env).toEqual({ A: '1' })
  })

  it('finds the repository by the longest worktree or checkout path', () => {
    const worktrees = ['r1::/work/r1-wt', 'r2::/work/r1-wt/nested']
    const repos = [{ id: 'r1', path: '/repos/r1' }]
    expect(findRepoForPath('/work/r1-wt/src', worktrees, repos)).toBe('r1')
    expect(findRepoForPath('/work/r1-wt/nested/x', worktrees, repos)).toBe('r2')
    expect(findRepoForPath('/repos/r1', worktrees, repos)).toBe('r1')
    expect(findRepoForPath('/work/r1-wt-other', worktrees, repos)).toBeNull()
    expect(workspacePathOf('r1::/work/r1-wt')).toBe('/work/r1-wt')
  })
})
