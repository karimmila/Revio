import { describe, expect, it } from 'vitest'
import {
  revioCustomSections,
  deleteSection,
  moveWorkspaceToSection
} from './revio-sidebar-sections'
import { reorderSection } from './RevioSectionDialog'

describe('Sidebar sections', () => {
  const settings = {
    revioLayout: true,
    revioSidebarSections: [
      { id: 'a', name: 'Ideas' },
      { id: 'b', name: 'Later' }
    ],
    revioWorkspaceSections: { w1: 'a', w2: 'b', w3: 'a' }
  }

  it('builds sections with their workspaces, only in the workspace layout', () => {
    const sections = revioCustomSections(settings)
    expect(sections.map((s) => [s.key, s.label, [...s.worktreeIds]])).toEqual([
      ['custom-section:a', 'Ideas', ['w1', 'w3']],
      ['custom-section:b', 'Later', ['w2']]
    ])
    expect(revioCustomSections({ ...settings, revioLayout: false })).toEqual([])
  })

  it('moves a workspace in and out of a section', () => {
    expect(moveWorkspaceToSection({ w1: 'a' }, 'w2', 'b')).toEqual({ w1: 'a', w2: 'b' })
    expect(moveWorkspaceToSection({ w1: 'a' }, 'w1', null)).toEqual({})
  })

  it('deletes a section and returns its workspaces to the list', () => {
    expect(deleteSection(settings, 'a')).toEqual({
      revioSidebarSections: [{ id: 'b', name: 'Later' }],
      revioWorkspaceSections: { w2: 'b' }
    })
  })

  it('reorders sections within bounds', () => {
    expect(reorderSection(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(reorderSection(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
