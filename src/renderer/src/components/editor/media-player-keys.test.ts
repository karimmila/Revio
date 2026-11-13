import { expect, it } from 'vitest'
import { mediaPlayerKeyAction, steppedPlaybackRate } from './media-player-keys'

const key = (k: string, mods: Partial<{ metaKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods
})

it("maps the layout's player keys", () => {
  expect(mediaPlayerKeyAction(key(' '))).toEqual({ kind: 'toggle-play' })
  expect(mediaPlayerKeyAction(key('k'))).toEqual({ kind: 'toggle-play' })
  expect(mediaPlayerKeyAction(key('j'))).toEqual({ kind: 'seek', seconds: -10 })
  expect(mediaPlayerKeyAction(key('ArrowRight'))).toEqual({ kind: 'seek', seconds: 5 })
  expect(mediaPlayerKeyAction(key('>'))).toEqual({ kind: 'rate', step: 1 })
  expect(mediaPlayerKeyAction(key('m'))).toEqual({ kind: 'mute' })
  expect(mediaPlayerKeyAction(key('f'))).toEqual({ kind: 'fullscreen' })
  expect(mediaPlayerKeyAction(key('f', { metaKey: true }))).toBeNull()
  expect(mediaPlayerKeyAction(key('x'))).toBeNull()
})

it('steps the playback rate within 0.25×–2×', () => {
  expect(steppedPlaybackRate(1, 1)).toBe(1.25)
  expect(steppedPlaybackRate(1, -1)).toBe(0.75)
  expect(steppedPlaybackRate(2, 1)).toBe(2)
  expect(steppedPlaybackRate(0.25, -1)).toBe(0.25)
})
