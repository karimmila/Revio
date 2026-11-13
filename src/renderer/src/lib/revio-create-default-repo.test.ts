import { afterEach, describe, expect, it } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import {
  avoidHomeFolderDefault,
  isHomeFolderProject,
  notePickedProject,
  pickedHomeFolderRepoId,
  rememberCreateRepo
} from './revio-create-default-repo'
import { resolveWorkspaceCreationTarget } from './project-host-workspace-target'

function repo(id: string, path: string, overrides: Partial<Repo> = {}): Repo {
  return { id, path, displayName: id, badgeColor: '', addedAt: 0, kind: 'git', ...overrides }
}

const home = repo('home', '/Users/me', { displayName: '~', kind: 'folder' })
const alpha = repo('alpha', '/Users/me/code/alpha')
const beta = repo('beta', '/Users/me/code/beta')

afterEach(() => {
  rememberCreateRepo(home)
})

describe('isHomeFolderProject', () => {
  it.each([
    ['/Users/me', true],
    ['/home/me/', true],
    ['/root', true],
    ['C:\\Users\\me', true],
    ['/Users/me/code', false],
    ['/srv/data', false]
  ])('folder project at %s → %s', (path, expected) => {
    expect(isHomeFolderProject(repo('x', path, { kind: 'folder' }))).toBe(expected)
  })

  it('knows the seeded "~" project away from a standard home path', () => {
    expect(
      isHomeFolderProject(repo('x', '/Volumes/me', { kind: 'folder', displayName: '~' }))
    ).toBe(true)
  })

  it('never treats a Git repository as the home folder', () => {
    expect(isHomeFolderProject(repo('x', '/Users/me', { displayName: '~' }))).toBe(false)
  })
})

describe('the home-folder pick record', () => {
  it('keeps only a home-folder pick, and a create clears it', () => {
    notePickedProject(home)
    expect(pickedHomeFolderRepoId()).toBe('home')
    notePickedProject(alpha)
    expect(pickedHomeFolderRepoId()).toBeNull()
    notePickedProject(home)
    rememberCreateRepo(alpha)
    expect(pickedHomeFolderRepoId()).toBeNull()
  })
})

describe('avoidHomeFolderDefault', () => {
  const eligibleRepos = [home, alpha, beta]
  const seededOnHome = (repos: readonly Repo[]) => {
    const input = { eligibleRepos: repos, activeRepoId: 'home' }
    return { input, resolution: resolveWorkspaceCreationTarget(input) }
  }

  it('moves a home-folder seed to the last real project created in', () => {
    const { input, resolution } = seededOnHome(eligibleRepos)
    expect(resolution).toMatchObject({ status: 'ready', target: { repoId: 'home' } })
    const result = avoidHomeFolderDefault({
      resolution,
      input,
      lastCreatedRepoId: 'beta',
      explicitHomeRepoId: null
    })
    expect(result).toMatchObject({ status: 'ready', target: { repoId: 'beta' } })
  })

  it('falls back to the first real project when the last one is gone', () => {
    const { input, resolution } = seededOnHome(eligibleRepos)
    const result = avoidHomeFolderDefault({
      resolution,
      input,
      lastCreatedRepoId: 'removed',
      explicitHomeRepoId: null
    })
    expect(result).toMatchObject({ status: 'ready', target: { repoId: 'alpha' } })
  })

  it('keeps the home folder when the person picked it', () => {
    const { input, resolution } = seededOnHome(eligibleRepos)
    const result = avoidHomeFolderDefault({
      resolution,
      input,
      lastCreatedRepoId: 'beta',
      explicitHomeRepoId: 'home'
    })
    expect(result).toBe(resolution)
  })

  it('keeps the home folder when it is the only project', () => {
    const { input, resolution } = seededOnHome([home])
    const result = avoidHomeFolderDefault({
      resolution,
      input,
      lastCreatedRepoId: null,
      explicitHomeRepoId: null
    })
    expect(result).toMatchObject({ status: 'ready', target: { repoId: 'home' } })
  })
})
