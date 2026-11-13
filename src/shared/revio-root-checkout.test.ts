import { describe, expect, it } from 'vitest'
import {
  isRevioRootCheckout,
  revioRootCheckoutIds,
  revioUnlistedCheckoutIds,
  withoutRevioRootCheckoutKeys,
  withoutRevioRootCheckouts
} from './revio-root-checkout'

const workspaceLayout = { revioLayout: true }
const repos = [
  { id: 'local', kind: 'git' },
  { id: 'folder', kind: 'folder' },
  { id: 'cloud', kind: 'git', executionHostId: 'runtime:env-1' }
]
const root = { id: 'local::/code/app', repoId: 'local', isMainWorktree: true }
const workspace = { id: 'local::/ws/app/oslo', repoId: 'local', isMainWorktree: false }
const cloudRoot = { id: 'cloud::/vercel/sandbox', repoId: 'cloud', isMainWorktree: true }

describe('root checkout in the workspace layout', () => {
  it('is the main checkout of a local repository, and nothing else', () => {
    expect(isRevioRootCheckout(workspaceLayout, repos, root)).toBe(true)
    expect(isRevioRootCheckout(workspaceLayout, repos, workspace)).toBe(false)
    // A cloud workspace is its sandbox's root: that one is the workspace.
    expect(isRevioRootCheckout(workspaceLayout, repos, cloudRoot)).toBe(false)
    expect(
      isRevioRootCheckout(workspaceLayout, repos, {
        ...root,
        ephemeralVmCheckoutMode: 'provisioned-root'
      })
    ).toBe(false)
    expect(
      isRevioRootCheckout(workspaceLayout, repos, {
        ...root,
        id: 'folder::/notes',
        repoId: 'folder'
      })
    ).toBe(false)
    expect(isRevioRootCheckout(workspaceLayout, repos, null)).toBe(false)
  })

  it('does not exist in the classic layout', () => {
    expect(isRevioRootCheckout({ revioLayout: false }, repos, root)).toBe(false)
    expect(isRevioRootCheckout(null, repos, root)).toBe(false)
    expect(revioRootCheckoutIds(null, repos, { local: [root, workspace] }).size).toBe(0)
  })

  it('leaves a folder project’s own folder out of lists too, without calling it a root checkout', () => {
    const folderRoot = { id: 'folder::/Users/me', repoId: 'folder', isMainWorktree: true }
    const worktreesByRepo = {
      local: [root, workspace],
      folder: [folderRoot],
      cloud: [cloudRoot]
    }
    expect(revioUnlistedCheckoutIds(workspaceLayout, repos, worktreesByRepo)).toEqual(
      new Set([root.id, folderRoot.id])
    )
    expect(isRevioRootCheckout(workspaceLayout, repos, folderRoot)).toBe(false)
    expect(revioUnlistedCheckoutIds(null, repos, worktreesByRepo).size).toBe(0)
  })

  it('leaves the root checkout out of lists and of maps keyed by worktree', () => {
    const worktreesByRepo = { local: [root, workspace], cloud: [cloudRoot] }
    const ids = revioRootCheckoutIds(workspaceLayout, repos, worktreesByRepo)
    expect([...ids]).toEqual([root.id])
    expect(withoutRevioRootCheckouts(worktreesByRepo, ids)).toEqual({
      local: [workspace],
      cloud: [cloudRoot]
    })
    const tabs = { [root.id]: ['chat'], [workspace.id]: ['terminal'] }
    expect(withoutRevioRootCheckoutKeys(tabs, ids)).toEqual({ [workspace.id]: ['terminal'] })
    const untouched = { [workspace.id]: ['terminal'] }
    expect(withoutRevioRootCheckoutKeys(untouched, ids)).toBe(untouched)
    expect(withoutRevioRootCheckouts(worktreesByRepo, new Set())).toBe(worktreesByRepo)
  })
})
