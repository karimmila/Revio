import { describe, expect, it } from 'vitest'
import { arrangeRevioComposerControls, revioShowsContextUsage } from './revio-composer-controls'

const control = (id: string) => ({ id, content: id })

describe('arrangeRevioComposerControls', () => {
  it('leads with the model, keeps the permissions slot (Auto-accept edits), and moves attach beside Send', () => {
    const { left, right } = arrangeRevioComposerControls(
      [control('attach'), control('permissions'), control('plan')],
      [control('model'), control('mcp'), control('context'), control('dictation')]
    )
    expect(left.map((item) => item.id)).toEqual(['model', 'permissions', 'plan'])
    expect(right.map((item) => item.id)).toEqual(['attach', 'mcp', 'context', 'dictation'])
  })
})

it('shows context use above 70% unless always shown', () => {
  expect(revioShowsContextUsage(70, false)).toBe(false)
  expect(revioShowsContextUsage(71, false)).toBe(true)
  expect(revioShowsContextUsage(5, true)).toBe(true)
})
