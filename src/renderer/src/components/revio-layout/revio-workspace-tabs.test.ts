import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_TABS_MAX,
  withoutWorkspaceTab,
  withVisitedWorkspace
} from './revio-workspace-tabs'

describe('workspace tabs', () => {
  it('adds a newly visited workspace once, keeping the newest under the cap', () => {
    expect(withVisitedWorkspace(['a'], 'a')).toEqual(['a'])
    expect(withVisitedWorkspace(['a'], null)).toEqual(['a'])
    const many = Array.from({ length: WORKSPACE_TABS_MAX }, (_, index) => `w${index}`)
    expect(withVisitedWorkspace(many, 'new').at(-1)).toBe('new')
    expect(withVisitedWorkspace(many, 'new')).toHaveLength(WORKSPACE_TABS_MAX)
  })

  it('closes a tab and drops missing workspaces', () => {
    expect(withoutWorkspaceTab(['a', 'b', 'c'], 'b', (id) => id !== 'c')).toEqual(['a'])
  })
})
