import { describe, expect, it } from 'vitest'
import { keepWorkspaceSurfaceOrder } from './workspace-surface-projection'

const surface = (id: string) => ({ id, path: `/ws/${id}` })
const ids = (surfaces: readonly { id: string }[]) => surfaces.map((s) => s.id)

describe('keepWorkspaceSurfaceOrder', () => {
  it('adds a workspace the catalog lists first without moving mounted ones', () => {
    // git lists worktrees by name: a new "add-…" workspace sorts before the older ones.
    const previous = ['cart-total-tests', 'dark-mode-toggle', 'fix-login-redirect']
    const refreshed = ['add-a-newsletter', ...previous].map(surface)
    expect(ids(keepWorkspaceSurfaceOrder(previous, refreshed))).toEqual([
      'cart-total-tests',
      'dark-mode-toggle',
      'fix-login-redirect',
      'add-a-newsletter'
    ])
  })

  it('keeps the first-seen order when the catalog reorders, and drops removed ones', () => {
    const previous = ['b', 'a', 'c']
    expect(ids(keepWorkspaceSurfaceOrder(previous, ['a', 'c', 'd'].map(surface)))).toEqual([
      'a',
      'c',
      'd'
    ])
    expect(ids(keepWorkspaceSurfaceOrder(previous, ['c', 'b', 'a'].map(surface)))).toEqual([
      'b',
      'a',
      'c'
    ])
  })

  it('takes the catalog order on first projection and keeps each surface’s path', () => {
    const result = keepWorkspaceSurfaceOrder([], ['z', 'a'].map(surface))
    expect(result).toEqual([surface('z'), surface('a')])
  })
})
