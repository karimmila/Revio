import { describe, expect, it } from 'vitest'
import { scopeToRevioWorkspaces } from './revio-workspace-scope'

const NO_IDS: readonly string[] = []
const base = {
  filterRepoIds: NO_IDS,
  hideDefaultBranchWorkspace: false,
  alwaysShowDefaultBranchWorkspace: true
}

describe('scopeToRevioWorkspaces', () => {
  it('lists only Git repositories and hides each repository checkout', () => {
    expect(scopeToRevioWorkspaces(base, ['git-a', 'git-b'])).toEqual({
      filterRepoIds: ['git-a', 'git-b'],
      hideDefaultBranchWorkspace: true,
      alwaysShowDefaultBranchWorkspace: false
    })
  })

  it('keeps a project filter the user chose, minus folder projects', () => {
    const scoped = scopeToRevioWorkspaces({ ...base, filterRepoIds: ['git-b', 'folder'] }, [
      'git-a',
      'git-b'
    ])
    expect(scoped.filterRepoIds).toEqual(['git-b'])
  })

  it('lists nothing for a location without repositories', () => {
    expect(scopeToRevioWorkspaces(base, NO_IDS).filterRepoIds).toEqual(['revio-location:none'])
  })
})
