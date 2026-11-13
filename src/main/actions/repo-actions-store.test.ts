import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const userData = vi.hoisted(() => ({ path: '' }))
vi.mock('electron', () => ({ app: { getPath: () => userData.path } }))

import { SHARED_ACTIONS_FILES } from '../../shared/actions/repo-actions'
import { readRepoActions } from './repo-actions-store'

const [NAMED_FILE, LEGACY_FILE] = SHARED_ACTIONS_FILES
const action = (name: string): string =>
  `[[action]]\nname = "${name}"\nscript = "echo ${name}"\ntargets = ["local"]\n`

let root: string
let repo: { id: string; path: string }
function writeShared(file: string, name: string): void {
  mkdirSync(join(repo.path, file, '..'), { recursive: true })
  writeFileSync(join(repo.path, file), action(name))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'repo-actions-store-'))
  userData.path = join(root, 'user-data')
  repo = { id: 'repo-1', path: join(root, 'repo') }
  mkdirSync(repo.path, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('shared actions file', () => {
  it('is the app-named file for a repository that has none yet', () => {
    const listed = readRepoActions(repo)
    expect(listed.actions).toEqual([])
    expect(listed.sharedFileName).toBe(NAMED_FILE)
    expect(listed.sharedFile).toBe(join(repo.path, NAMED_FILE))
  })

  it('still reads upstream’s file, and says that is the file in use', () => {
    writeShared(LEGACY_FILE, 'legacy')
    const listed = readRepoActions(repo)
    expect(listed.actions.map((entry) => entry.name)).toEqual(['legacy'])
    expect(listed.sharedFileName).toBe(LEGACY_FILE)
  })

  it('prefers the app-named file when a repository has both', () => {
    writeShared(LEGACY_FILE, 'legacy')
    writeShared(NAMED_FILE, 'named')
    const listed = readRepoActions(repo)
    expect(listed.actions.map((entry) => entry.name)).toEqual(['named'])
    expect(listed.sharedFileName).toBe(NAMED_FILE)
  })
})
