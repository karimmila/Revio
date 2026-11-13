import { describe, expect, it } from 'vitest'
import { revioNewWorkspacePageOn } from './revio-new-workspace-page'

describe('revioNewWorkspacePageOn', () => {
  it('is on only in the workspace layout with the experimental setting', () => {
    expect(revioNewWorkspacePageOn({ revioLayout: true, revioNewWorkspacePage: true })).toBe(true)
    expect(revioNewWorkspacePageOn({ revioLayout: true })).toBe(false)
    expect(revioNewWorkspacePageOn({ revioLayout: false, revioNewWorkspacePage: true })).toBe(false)
    expect(revioNewWorkspacePageOn(null)).toBe(false)
  })
})
