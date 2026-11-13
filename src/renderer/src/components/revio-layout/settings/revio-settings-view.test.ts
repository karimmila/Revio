import { describe, expect, it } from 'vitest'
import { revioSettingsPageForTarget, revioSettingsPageFrom } from './revio-settings-view'

describe('revioSettingsPageFrom', () => {
  it('maps deep-link page names and falls back to General', () => {
    expect(revioSettingsPageFrom('mcp')).toBe('mcp')
    expect(revioSettingsPageFrom('repo:r1')).toBe('repo:r1')
    expect(revioSettingsPageFrom('repo:')).toBe('general')
    expect(revioSettingsPageFrom('nope')).toBe('general')
  })
})

describe('revioSettingsPageForTarget', () => {
  it("opens the page that holds an upstream pane's setting", () => {
    expect(revioSettingsPageForTarget({ pane: 'shortcuts', repoId: null })).toBe('shortcuts')
    expect(revioSettingsPageForTarget({ pane: 'accounts', repoId: null })).toBe('agents')
    expect(revioSettingsPageForTarget({ pane: 'integrations', repoId: null })).toBe('account')
    expect(revioSettingsPageForTarget({ pane: 'repo', repoId: 'r1' })).toBe('repo:r1')
  })

  it('opens General for a pane the workspace layout has no page for', () => {
    expect(revioSettingsPageForTarget({ pane: 'ssh', repoId: null })).toBe('general')
    expect(revioSettingsPageForTarget({ pane: 'plugins', repoId: null })).toBe('general')
    expect(revioSettingsPageForTarget({ pane: 'repo', repoId: null })).toBe('general')
  })
})
