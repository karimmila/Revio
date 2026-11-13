import { describe, expect, it } from 'vitest'
import { getSmartWorkspaceNameFieldCopy } from './smart-workspace-name-field-copy'

function placeholder(githubOnly: boolean, linearAvailable = false): string {
  return getSmartWorkspaceNameFieldCopy({
    repoBackedSourcesDisabled: false,
    linearAvailable,
    branchesEnabled: true,
    crossRepoSwitchTarget: 'project',
    disabled: false,
    mode: 'smart',
    githubOnly
  }).placeholder
}

describe('Create from placeholder', () => {
  it('names only GitHub, and Linear once connected, in the workspace layout', () => {
    expect(placeholder(true)).toBe('Type a name, #1234, branch or GitHub URL')
    expect(placeholder(true, true)).toBe('Type a name, #1234, branch, GitHub or Linear URL')
  })

  it('names every upstream source in the classic layout', () => {
    expect(placeholder(false)).toBe('Type a name, #1234, branch, GitHub, GitLab, or Jira URL')
  })
})
