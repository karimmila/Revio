import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/constants'
import { createInitialHomeWorkspaceState } from './initial-home-workspace'

function freshState(revioLayout: boolean) {
  const defaults = getDefaultPersistedState('/home/user')
  return { ...defaults, settings: { ...defaults.settings, revioLayout } }
}

describe('first-launch home workspace', () => {
  it('adds no project in the workspace layout', () => {
    const seeded = createInitialHomeWorkspaceState(freshState(true))

    expect(seeded.repos).toEqual([])
    expect(seeded.workspaceSession.activeWorktreeId).toBeNull()
  })

  it('opens the home folder in the classic layout', () => {
    const seeded = createInitialHomeWorkspaceState(freshState(false))

    expect(seeded.repos).toEqual([
      expect.objectContaining({ kind: 'folder', path: homedir(), displayName: '~' })
    ])
    expect(seeded.workspaceSession.activeRepoId).toBe(seeded.repos[0].id)
  })
})
