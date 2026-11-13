import { describe, expect, it } from 'vitest'
import { setupScriptPromptHasContext } from './setup-script-prompt-render-state'

const workspace = { isMainWorktree: false }
const projectFolder = { isMainWorktree: true }

describe('setupScriptPromptHasContext', () => {
  it('is false on Home in the workspace layout, where no workspace is open', () => {
    expect(
      setupScriptPromptHasContext({
        revioLayout: true,
        repoId: 'web',
        activeWorktree: null,
        repoWorktrees: [projectFolder, workspace]
      })
    ).toBe(false)
  })

  it('is true inside a workspace of the project', () => {
    expect(
      setupScriptPromptHasContext({
        revioLayout: true,
        repoId: 'web',
        activeWorktree: { repoId: 'web' },
        repoWorktrees: [projectFolder, workspace]
      })
    ).toBe(true)
  })

  it('is false for a project with no workspace, and inside another project', () => {
    expect(
      setupScriptPromptHasContext({
        revioLayout: true,
        repoId: 'web',
        activeWorktree: { repoId: 'web' },
        repoWorktrees: [projectFolder]
      })
    ).toBe(false)
    expect(
      setupScriptPromptHasContext({
        revioLayout: true,
        repoId: 'web',
        activeWorktree: { repoId: 'api' },
        repoWorktrees: [workspace]
      })
    ).toBe(false)
  })

  it('leaves the classic layout as it was: the active project', () => {
    expect(
      setupScriptPromptHasContext({
        revioLayout: false,
        repoId: 'web',
        activeWorktree: null,
        repoWorktrees: []
      })
    ).toBe(true)
  })
})
