import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getRefCompare } from './ref-compare'

describe('getRefCompare on a stack of branches', () => {
  const tempPaths: string[] = []

  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  /** main ← one (a.txt) ← two (b.txt), with HEAD on two, as one agent builds a stack. */
  function createStack(): string {
    const repoPath = mkdtempSync(join(tmpdir(), 'orca-ref-compare-'))
    tempPaths.push(repoPath)
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' })
    git('init', '--quiet', '-b', 'main')
    git('config', 'user.name', 'Orca Test')
    git('config', 'user.email', 'orca@example.test')
    git('config', 'commit.gpgSign', 'false')
    git('config', 'core.hooksPath', '.git/no-hooks')
    writeFileSync(join(repoPath, 'base.txt'), 'base\n')
    git('add', '.')
    git('commit', '--quiet', '-m', 'base')
    git('checkout', '--quiet', '-b', 'one')
    writeFileSync(join(repoPath, 'a.txt'), 'a\n')
    git('add', '.')
    git('commit', '--quiet', '-m', 'one')
    git('checkout', '--quiet', '-b', 'two')
    writeFileSync(join(repoPath, 'b.txt'), 'b\nb\n')
    git('add', '.')
    git('commit', '--quiet', '-m', 'two')
    return repoPath
  }

  it('lists only the files a lower PR changes against its own base, though HEAD is above it', async () => {
    const repoPath = createStack()
    const result = await getRefCompare(repoPath, 'main', 'one')
    expect(result.summary.status).toBe('ready')
    expect(result.summary.compareRef).toBe('refs/heads/one')
    expect(result.entries.map((entry) => entry.path)).toEqual(['a.txt'])
  })

  it('compares the top PR, at HEAD, against the PR below it', async () => {
    const repoPath = createStack()
    const result = await getRefCompare(repoPath, 'one', 'HEAD')
    expect(result.entries.map((entry) => [entry.path, entry.added])).toEqual([['b.txt', 2]])
  })

  it('reports a branch that is not in the repository instead of throwing', async () => {
    const repoPath = createStack()
    const result = await getRefCompare(repoPath, 'one', 'not-fetched')
    expect(result.summary.status).toBe('error')
    expect(result.summary.errorMessage).toContain('not-fetched')
    expect(result.entries).toEqual([])
  })
})
