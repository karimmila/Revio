import { describe, expect, it } from 'vitest'
import {
  buildRevioLink,
  buildLoadoutLink,
  revioLinkFromArguments,
  parseRevioLink,
  parseRevioRoute
} from './revio-link'
import { LEGACY_NAME } from './legacy-name-migration'

const legacy = (route: string): string => `orca://${LEGACY_NAME}/${route}`

describe('Workspace links', () => {
  it('round-trips a workspace id with a path in it, and a chat', () => {
    const link = { worktreeId: 'repo::/Users/me/work tree', sessionId: 'claude_1' }
    expect(parseRevioLink(buildRevioLink(link))).toEqual(link)
    expect(parseRevioLink(buildRevioLink({ worktreeId: 'w' }))).toEqual({ worktreeId: 'w' })
  })

  it('refuses other links and finds one among launch arguments', () => {
    expect(parseRevioLink('orca://skills/share/abc')).toBeNull()
    expect(parseRevioLink('https://workspace?id=w')).toBeNull()
    expect(parseRevioLink('revio://workspace')).toBeNull()
    expect(buildRevioLink({ worktreeId: 'w' })).toBe('revio://workspace?id=w')
    const link = buildRevioLink({ worktreeId: 'w' })
    expect(revioLinkFromArguments(['--flag', link])).toBe(link)
  })
})

describe('App routes', () => {
  it('parses settings pages and the Create card', () => {
    expect(parseRevioRoute('revio://settings?page=shortcuts')).toEqual({
      kind: 'settings',
      page: 'shortcuts'
    })
    expect(parseRevioRoute('revio://settings')).toEqual({
      kind: 'settings',
      page: 'general'
    })
    expect(parseRevioRoute('revio://new')).toEqual({ kind: 'create' })
    expect(parseRevioRoute('revio://settings?page=a%20b')).toBeNull()
    expect(parseRevioRoute('orca://workspace?id=w1')).toEqual({
      kind: 'workspace',
      worktreeId: 'w1'
    })
    expect(parseRevioRoute('revio://skills/share/abc')).toBeNull()
    expect(revioLinkFromArguments(['x', 'revio://new'])).toBe('revio://new')
  })

  it('still opens links copied before the rename', () => {
    expect(parseRevioLink(legacy('workspace?id=w2&chat=c1'))).toEqual({
      worktreeId: 'w2',
      sessionId: 'c1'
    })
    expect(parseRevioRoute(legacy('settings?page=shortcuts'))).toEqual({
      kind: 'settings',
      page: 'shortcuts'
    })
    expect(parseRevioRoute(legacy('new'))).toEqual({ kind: 'create' })
    expect(parseRevioRoute(legacy('loadout?agent=claude&model=opus'))).toEqual({
      kind: 'loadout',
      loadout: { agent: 'claude', model: 'opus', label: 'opus' }
    })
    expect(parseRevioLink(legacy('workspace'))).toBeNull()
  })
})

describe('Loadout links', () => {
  it('round-trips a loadout and needs an agent and a model', () => {
    const loadout = { agent: 'claude', model: 'opus', effort: 'high', label: 'Opus · High' }
    expect(parseRevioRoute(buildLoadoutLink(loadout))).toEqual({ kind: 'loadout', loadout })
    expect(buildLoadoutLink(loadout).startsWith('revio://loadout?')).toBe(true)
    expect(parseRevioRoute('revio://loadout?agent=claude&model=opus')).toEqual({
      kind: 'loadout',
      loadout: { agent: 'claude', model: 'opus', label: 'opus' }
    })
    expect(parseRevioRoute('revio://loadout?agent=claude')).toBeNull()
  })
})
