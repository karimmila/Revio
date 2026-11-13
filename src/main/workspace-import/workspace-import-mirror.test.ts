import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  mkdirSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyMirrorChanges, fetchMirrorCommit, readMirrorChanges } from './workspace-import-mirror'
import { readAsleepCloudPayloadManifest, writeAsleepCloudPayload } from './asleep-cloud-payload'

let root: string
const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' }
  })

function makeRepo(path: string): void {
  mkdirSync(path, { recursive: true })
  run(path, 'init', '-q', '-b', 'main')
  run(path, 'config', 'user.email', 't@example.com')
  run(path, 'config', 'user.name', 't')
  writeFileSync(join(path, 'app.txt'), 'one\n')
  writeFileSync(join(path, '.gitignore'), 'build/\n')
  run(path, 'add', '.')
  run(path, 'commit', '-q', '-m', 'base')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-mirror-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('mirror changes', () => {
  it('brings the commit, edits and new files over without changing the mirror', async () => {
    const mirror = join(root, 'mirror')
    makeRepo(mirror)
    writeFileSync(join(mirror, 'app.txt'), 'one\nmirror commit\n')
    run(mirror, 'commit', '-q', '-am', 'cloud work')
    writeFileSync(join(mirror, 'app.txt'), 'one\nmirror commit\nuncommitted\n')
    writeFileSync(join(mirror, 'notes.md'), 'new file\n')
    mkdirSync(join(mirror, '.context'))
    writeFileSync(join(mirror, '.context', 'scratch.txt'), 'skip\n')
    mkdirSync(join(mirror, 'build'))
    writeFileSync(join(mirror, 'build', 'out.js'), 'ignored\n')
    const statusBefore = run(mirror, 'status', '--porcelain')

    const clone = join(root, 'clone')
    run(root, 'clone', '-q', mirror, clone)
    run(clone, 'reset', '-q', '--hard', 'HEAD~1')

    const changes = await readMirrorChanges(mirror)
    expect(changes.untracked).toEqual(['notes.md'])
    expect(await fetchMirrorCommit(clone, mirror, changes.head)).toBe(true)
    const worktree = join(root, 'wt')
    run(clone, 'worktree', 'add', '-q', '-b', 'imported', worktree, changes.head)

    expect(await applyMirrorChanges(worktree, mirror, changes)).toBe('applied')
    expect(readFileSync(join(worktree, 'app.txt'), 'utf8')).toBe(
      'one\nmirror commit\nuncommitted\n'
    )
    expect(readFileSync(join(worktree, 'notes.md'), 'utf8')).toBe('new file\n')
    expect(existsSync(join(worktree, '.context'))).toBe(false)
    expect(run(mirror, 'status', '--porcelain')).toBe(statusBefore)
  })

  it('keeps changes that do not apply in a folder of their own', async () => {
    const mirror = join(root, 'mirror')
    makeRepo(mirror)
    writeFileSync(join(mirror, 'app.txt'), 'two\n')
    const changes = await readMirrorChanges(mirror)
    const other = join(root, 'other')
    makeRepo(other)
    writeFileSync(join(other, 'app.txt'), 'conflicting\n')
    run(other, 'commit', '-q', '-am', 'diverge')

    expect(await applyMirrorChanges(other, mirror, changes)).toBe('kept-aside')
    expect(
      readFileSync(join(other, '.revio-import', 'uncommitted-changes.patch'), 'utf8')
    ).toContain('+two')
    expect(readFileSync(join(other, 'app.txt'), 'utf8')).toBe('conflicting\n')
  })

  it('never follows a symlink left in the mirror to a file outside it', async () => {
    const secret = join(root, 'id_ed25519')
    writeFileSync(secret, 'PRIVATE KEY\n')
    const mirror = join(root, 'mirror')
    makeRepo(mirror)
    writeFileSync(join(mirror, 'notes.md'), 'new file\n')
    symlinkSync('../id_ed25519', join(mirror, 'key.txt'))
    symlinkSync(root, join(mirror, 'outside'))

    const changes = await readMirrorChanges(mirror)
    expect(changes.untracked).toEqual(['notes.md'])

    // A link that replaces a listed file after the read is not followed either.
    const worktree = join(root, 'wt')
    makeRepo(worktree)
    const swapped = { ...changes, untracked: ['notes.md', 'key.txt'] }
    expect(await applyMirrorChanges(worktree, mirror, swapped)).toBe('applied')
    expect(readFileSync(join(worktree, 'notes.md'), 'utf8')).toBe('new file\n')
    expect(existsSync(join(worktree, 'key.txt'))).toBe(false)

    const payload = join(root, 'payload')
    await writeAsleepCloudPayload({
      dir: payload,
      repoPath: null,
      mirrorPath: mirror,
      changes: swapped,
      sourceCwd: '/home/vm/web',
      bundleRef: 'refs/revio-import/test'
    })
    expect(readAsleepCloudPayloadManifest(payload)?.untracked).toEqual(['notes.md'])
    expect(existsSync(join(payload, 'new-files', 'key.txt'))).toBe(false)
  })

  it('does not run programs the mirror names in its git config', async () => {
    const mirror = join(root, 'mirror')
    makeRepo(mirror)
    const marker = join(root, 'ran')
    run(mirror, 'config', 'core.fsmonitor', `touch ${marker}; false`)
    writeFileSync(join(mirror, 'app.txt'), 'two\n')

    const changes = await readMirrorChanges(mirror)
    expect(changes.patch).toContain('+two')
    expect(existsSync(marker)).toBe(false)
  })
})
