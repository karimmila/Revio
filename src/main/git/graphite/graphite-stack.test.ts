import { describe, expect, it } from 'vitest'
import { buildGraphiteStack } from './graphite-stack'

const state = JSON.stringify({
  main: { trunk: true },
  a: { trunk: false, needs_restack: false, parents: [{ ref: 'main', sha: '1' }] },
  b: { trunk: false, needs_restack: true, parents: [{ ref: 'a', sha: '2' }] },
  c: { trunk: false, needs_restack: false, parents: [{ ref: 'b', sha: '3' }] },
  other: { trunk: false, parents: [{ ref: 'main', sha: '4' }] }
})

describe('buildGraphiteStack', () => {
  it('lists the stack from its top down to trunk', () => {
    const stack = buildGraphiteStack(state, 'b')
    expect(stack?.branches.map((b) => [b.name, b.current, b.trunk, b.needsRestack])).toEqual([
      ['c', false, false, false],
      ['b', true, false, true],
      ['a', false, false, false],
      ['main', false, true, false]
    ])
  })

  it('is null on trunk, an untracked branch or bad output', () => {
    expect(buildGraphiteStack(state, 'main')).toBeNull()
    expect(buildGraphiteStack(state, 'nope')).toBeNull()
    expect(buildGraphiteStack('not json', 'b')).toBeNull()
    expect(buildGraphiteStack('[]', 'b')).toBeNull()
  })
})
