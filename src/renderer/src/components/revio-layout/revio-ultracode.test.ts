// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { runUltracodeCommand } from './revio-ultracode'

const setOption = vi.hoisted(() => vi.fn(async () => ({ ok: true })))
vi.mock('@/components/native-chat/native-chat-composer-surface-registry', () => ({
  composerSurfaceFor: () => ({
    surface: { setOption },
    snapshot: () => [
      {
        id: 'effort',
        settable: true,
        kind: { type: 'select', choices: [{ value: 'high' }, { value: 'ultracode' }] }
      }
    ]
  })
}))

it('/ultracode sets Claude effort to Ultracode and clears the input', () => {
  document.execCommand = vi.fn(() => true)
  const input = document.createElement('div')
  input.textContent = '/ultracode '
  const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
  expect(runUltracodeCommand(enter, document.createElement('div'), input)).toBe(true)
  expect(enter.defaultPrevented).toBe(true)
  expect(setOption).toHaveBeenCalledWith('effort', 'ultracode')
  input.textContent = 'fix it'
  expect(runUltracodeCommand(new KeyboardEvent('keydown', { key: 'Enter' }), input, input)).toBe(
    false
  )
})
