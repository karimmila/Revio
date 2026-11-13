import { describe, expect, it } from 'vitest'
import { archivedDeleteSubject } from './revio-archived-delete-subject'

const date = (timestamp: number): string => `day ${timestamp}`
const record = (id: string, displayName: string, branch: string | null, archivedAt: number) => ({
  id,
  displayName,
  branch,
  archivedAt
})

describe('archivedDeleteSubject', () => {
  it('is the name alone when no other archived workspace shares it', () => {
    const one = record('a', 'Fix login', 'me/fix-login', 1)
    expect(archivedDeleteSubject(one, [one, record('b', 'Other', 'me/other', 2)], date)).toBe(
      'Fix login'
    )
  })

  it('adds the branch and the archive time when the name is shared', () => {
    const first = record('a', 'Fix login', 'me/fix-login', 1)
    const second = record('b', 'Fix login', 'me/fix-login-2', 2)
    expect(archivedDeleteSubject(first, [first, second], date)).toBe(
      'Fix login (me/fix-login, archived day 1)'
    )
    expect(archivedDeleteSubject(second, [first, second], date)).toBe(
      'Fix login (me/fix-login-2, archived day 2)'
    )
  })

  it('still tells detached workspaces apart, by the archive time', () => {
    const first = record('a', 'Untitled', null, 1)
    const second = record('b', 'Untitled', null, 2)
    expect(archivedDeleteSubject(first, [first, second], date)).toBe('Untitled (archived day 1)')
  })
})
