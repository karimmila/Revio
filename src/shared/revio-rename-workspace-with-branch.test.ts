import { expect, it } from 'vitest'
import { renamesWorkspaceWithBranch } from './revio-rename-workspace-with-branch'

it('renames the workspace with the branch unless the setting turns it off', () => {
  expect(renamesWorkspaceWithBranch({})).toBe(true)
  expect(renamesWorkspaceWithBranch({ revioRenameWorkspaceWithBranch: false })).toBe(false)
  expect(
    renamesWorkspaceWithBranch({
      revioLayout: false,
      revioRenameWorkspaceWithBranch: false
    })
  ).toBe(true)
})
