import { describe, expect, it } from 'vitest'
import { revioWorkspaceLabel } from './revio-workspace-label'

describe('revioWorkspaceLabel', () => {
  it('names a Mac workspace by its folder', () => {
    expect(
      revioWorkspaceLabel(
        { path: '/Users/me/orca/workspaces/repo/squid', displayName: 'Fix login', branch: 'squid' },
        false
      )
    ).toBe('squid')
  })

  it('names a cloud workspace as its sidebar row does, not by the sandbox checkout folder', () => {
    expect(
      revioWorkspaceLabel(
        {
          path: '/vercel/sample-app',
          displayName: 'cloud-test-list-the-top-level',
          branch: 'refs/heads/dev/cloud-test-list'
        },
        true
      )
    ).toBe('cloud-test-list-the-top-level')
  })

  it('falls back to the branch for an unnamed cloud workspace', () => {
    expect(
      revioWorkspaceLabel(
        { path: '/vercel/sample-app', displayName: ' ', branch: 'refs/heads/dev/x' },
        true
      )
    ).toBe('dev/x')
  })

  it("follows the sidebar row to the PR's title while the name is only the branch", () => {
    const worktree = {
      path: '/vercel/sample-app',
      displayName: 'cloud-round-2-restart-the',
      branch: 'refs/heads/cloud-round-2-restart-the'
    }
    expect(revioWorkspaceLabel(worktree, true, null)).toBe('cloud-round-2-restart-the')
    expect(revioWorkspaceLabel(worktree, true, 'docs: add cloud round 2 note to README')).toBe(
      'docs: add cloud round 2 note to README'
    )
  })

  it('keeps a name the person gave over the PR title', () => {
    expect(
      revioWorkspaceLabel(
        { path: '/vercel/r', displayName: 'My name', branch: 'refs/heads/x' },
        true,
        'PR title'
      )
    ).toBe('My name')
  })
})
