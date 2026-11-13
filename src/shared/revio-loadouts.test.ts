import { expect, it } from 'vitest'
import { addLoadout, loadoutFitsChat, removeLoadout, type RevioLoadout } from './revio-loadouts'

const opus: RevioLoadout = {
  id: '1',
  agent: 'claude',
  model: 'opus',
  effort: 'high',
  label: 'Opus · High'
}

it('adds up to five distinct sets', () => {
  expect(addLoadout([], opus)).toEqual([opus])
  expect(addLoadout([opus], { ...opus, id: '2' })).toBe('exists')
  const five = Array.from({ length: 5 }, (_, n) => ({ ...opus, id: String(n), model: `m${n}` }))
  expect(addLoadout(five, opus)).toBe('full')
  expect(removeLoadout([opus], '1')).toEqual([])
})

it('fits a chat whose model list offers the model', () => {
  expect(loadoutFitsChat(opus, ['opus', 'sonnet'])).toBe(true)
  expect(loadoutFitsChat(opus, ['gpt-5'])).toBe(false)
  expect(loadoutFitsChat(opus, null)).toBe(false)
})
