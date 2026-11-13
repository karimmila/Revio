import { describe, expect, it } from 'vitest'
import {
  selectPendingCreationListingKey,
  selectSettingUpWorktreeIdsKey,
  selectShownCreationWorktreeId,
  withSettingUpRowsFirst,
  withoutListedCreations
} from './revio-pending-rows'

const pending = [{ creationId: 'c1' }, { creationId: 'c2' }, { creationId: 'c3' }]
const listed = (ids: string[]) => ids.map((id) => ({ id, repoId: 'r' }))

describe('withoutListedCreations', () => {
  it('drops the pending row once its worktree has its own row', () => {
    const creations = {
      c1: { worktreeId: 'r::/a', status: 'creating', request: { repoId: 'r' } },
      c2: { status: 'creating', request: { repoId: 'r' } },
      c3: { worktreeId: 'r::/c', status: 'error', request: { repoId: 'r' } }
    }
    expect(
      withoutListedCreations(
        pending,
        // @ts-expect-error only the fields the filter reads
        creations,
        listed(['r::/a', 'r::/c'])
      )
    ).toEqual([{ creationId: 'c2' }, { creationId: 'c3' }])
  })

  it("drops a cloud creation's row once its sandbox project's checkout is listed", () => {
    const cloud = {
      status: 'creating',
      request: {
        repoId: 'sandbox-repo',
        ephemeralVmCheckoutMode: 'provisioned-root',
        ephemeralVmRuntimeId: 'vm-1'
      }
    }
    const unprepared = { status: 'creating', request: { repoId: 'source-repo' } }
    const worktrees = [
      { id: 'sandbox-repo::/vercel/x', repoId: 'sandbox-repo', isMainWorktree: true },
      { id: 'source-repo::/x', repoId: 'source-repo', isMainWorktree: true }
    ]
    expect(
      withoutListedCreations(
        [{ creationId: 'c1' }, { creationId: 'c2' }],
        // @ts-expect-error only the fields the filter reads
        { c1: cloud, c2: unprepared },
        worktrees
      )
    ).toEqual([{ creationId: 'c2' }])
  })
})

describe('selectPendingCreationListingKey', () => {
  it('changes when a creation learns its worktree, so the rows are planned again', () => {
    const before = { c1: { creationId: 'c1', status: 'creating', request: { repoId: 'r' } } }
    const after = { c1: { ...before.c1, worktreeId: 'r::/a' } }
    // @ts-expect-error only the fields the key reads
    expect(selectPendingCreationListingKey(after)).not.toBe(selectPendingCreationListingKey(before))
  })
})

describe('selectShownCreationWorktreeId', () => {
  const state = {
    activeView: 'terminal',
    activePendingCreationId: 'c1',
    settings: { revioLayout: true },
    pendingWorktreeCreations: {
      c1: { creationId: 'c1', status: 'creating', loaderVisible: true, worktreeId: 'r::/a' }
    }
  }

  it("selects the creation's listed row while the creation is on screen", () => {
    // @ts-expect-error only the fields the selector reads
    expect(selectShownCreationWorktreeId(state)).toBe('r::/a')
    // @ts-expect-error only the fields the selector reads
    expect(selectShownCreationWorktreeId({ ...state, activeView: 'settings' })).toBeNull()
    // @ts-expect-error only the fields the selector reads
    expect(selectShownCreationWorktreeId({ ...state, settings: {} })).toBeNull()
  })
})

describe('withSettingUpRowsFirst', () => {
  it('puts the listed row of a creation still being set up where its pending row was', () => {
    const pendingWorktreeCreations = {
      c1: { status: 'creating', worktreeId: 'new::/vercel/x' },
      c2: { status: 'error', worktreeId: 'failed::/vercel/y' }
    }
    const key = selectSettingUpWorktreeIdsKey(
      // @ts-expect-error only the fields the selector reads
      { settings: { revioLayout: true }, pendingWorktreeCreations }
    )
    expect(key).toBe('new::/vercel/x')
    const sorted = ['runtime:e1|old::/vercel/a', 'runtime:e2|new::/vercel/x', 'failed::/vercel/y']
    expect(withSettingUpRowsFirst(sorted, key)).toEqual([
      'runtime:e2|new::/vercel/x',
      'runtime:e1|old::/vercel/a',
      'failed::/vercel/y'
    ])
    expect(withSettingUpRowsFirst(sorted, '')).toBe(sorted)
  })
})
