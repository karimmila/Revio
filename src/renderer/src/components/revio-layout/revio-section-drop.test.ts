import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}), subscribe: () => () => {} } }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/components/contextual-tours/workspace-creation-tour-handoff', () => ({
  openWorkspaceCreationComposerWithTourHandoff: vi.fn()
}))

import { moveWorkspacesToSection } from './use-revio-section-drop'
import { newWorktreeIds } from './revio-create-in-section'

describe('section drag and create in section', () => {
  it('moves every dropped workspace into the section, or back out', () => {
    expect(moveWorkspacesToSection({ a: 'x' }, ['a', 'b'], 'y')).toEqual({ a: 'y', b: 'y' })
    expect(moveWorkspacesToSection({ a: 'x', c: 'x' }, ['a'], null)).toEqual({ c: 'x' })
  })

  it('finds the workspaces created since the last look', () => {
    expect(newWorktreeIds(new Set(['a']), ['a', 'b', 'c'])).toEqual(['b', 'c'])
    expect(newWorktreeIds(new Set(['a']), ['a'])).toEqual([])
  })
})
