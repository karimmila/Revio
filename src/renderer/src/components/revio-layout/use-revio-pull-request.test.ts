import { describe, expect, it } from 'vitest'
import type { GitHubPRStackEntry, PRInfo } from '../../../../shared/github/pull-request-types'
import { stackEntryBase, toRevioStack } from './use-revio-pull-request'

function entry(position: number, number: number, headRefName: string): GitHubPRStackEntry {
  return {
    position,
    number,
    title: `PR ${number}`,
    url: `https://github.com/o/r/pull/${number}`,
    state: 'open',
    checksStatus: 'pending',
    mergeable: 'MERGEABLE',
    headRefName
  }
}

function pr(number: number, entries: GitHubPRStackEntry[] | undefined): PRInfo {
  return {
    number,
    title: 'top',
    state: 'open',
    url: '',
    checksStatus: 'pending',
    updatedAt: '',
    mergeable: 'MERGEABLE',
    ...(entries
      ? { stack: { number: 1, position: 3, size: entries.length, baseRefName: 'main', entries } }
      : {})
  }
}

describe('toRevioStack', () => {
  const entries = [entry(1, 8278, 'one'), entry(3, 8280, 'three'), entry(2, 8279, 'two')]

  it('lists the stack top first', () => {
    const stack = toRevioStack(pr(8280, entries))
    expect(stack?.entries.map((candidate) => candidate.number)).toEqual([8280, 8279, 8278])
    expect(stack?.ownNumber).toBe(8280)
  })

  it('treats a PR without a stack, or alone in one, as no stack', () => {
    expect(toRevioStack(pr(8280, undefined))).toBeNull()
    expect(toRevioStack(pr(8280, [entry(1, 8280, 'three')]))).toBeNull()
    expect(toRevioStack(null)).toBeNull()
  })

  it('bases each PR on the one below it and the bottom one on the stack base', () => {
    const stack = toRevioStack(pr(8280, entries))
    if (!stack) {
      throw new Error('expected a stack')
    }
    const byNumber = (number: number) =>
      stack.entries.find((candidate) => candidate.number === number)!
    expect(stackEntryBase(stack, byNumber(8280))).toBe('two')
    expect(stackEntryBase(stack, byNumber(8279))).toBe('one')
    expect(stackEntryBase(stack, byNumber(8278))).toBe('main')
  })
})
