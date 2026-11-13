import { describe, expect, it } from 'vitest'
import { isSafeConfigName, planAgentConfigSync } from './agent-config-sync-plan'

describe('planAgentConfigSync', () => {
  it('marks where each item lives and whether the copies differ', () => {
    const claude = new Map([
      ['a', 'x'],
      ['b', 'y']
    ])
    const codex = new Map([
      ['b', 'z'],
      ['c', 'w']
    ])
    expect(planAgentConfigSync('skill', claude, codex)).toEqual([
      { kind: 'skill', name: 'a', agents: ['claude'], same: true },
      { kind: 'skill', name: 'b', agents: ['claude', 'codex'], same: false },
      { kind: 'skill', name: 'c', agents: ['codex'], same: true }
    ])
  })

  it('accepts only plain names', () => {
    expect(isSafeConfigName('my-skill.v2')).toBe(true)
    expect(isSafeConfigName('../etc')).toBe(false)
    expect(isSafeConfigName('a/b')).toBe(false)
  })
})
