// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { handleRevioChatModeKey } from './revio-chat-mode-keys'
import { composerSurfaceFor } from '@/components/native-chat/native-chat-composer-surface-registry'

vi.mock('@/components/native-chat/native-chat-composer-surface-registry', () => ({
  composerSurfaceFor: vi.fn()
}))

afterEach(() => {
  document.body.innerHTML = ''
})

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
}

function setup(withApproval: boolean): { composer: HTMLElement; clicks: string[] } {
  document.body.innerHTML = `<div id="c"><div contenteditable="true" id="input"></div></div>${
    withApproval
      ? '<div data-native-chat-approval-actions><button>Yes</button><button>Yes, session</button><button>No</button></div>'
      : ''
  }`
  const clicks: string[] = []
  for (const button of document.querySelectorAll('button')) {
    button.addEventListener('click', () => clicks.push(button.textContent ?? ''))
  }
  const actions = document.querySelector<HTMLElement>('[data-native-chat-approval-actions]')
  if (actions) {
    actions.getBoundingClientRect = () => new DOMRect(0, 0, 300, 30)
  }
  const composer = document.getElementById('c')
  if (!composer) {
    throw new Error('no composer')
  }
  return { composer, clicks }
}

it('toggles plan mode with ⇧Tab and Fast mode with ⌘⇧E through the chat surface', () => {
  const { composer } = setup(false)
  const setOption = vi.fn(async () => ({ snapshot: [] }))
  vi.mocked(composerSurfaceFor).mockReturnValue({
    surface: {
      setOption,
      getSnapshot: () => [],
      invokeAction: setOption,
      subscribe: () => () => {}
    },
    snapshot: () => [
      {
        id: 'interactionMode',
        label: 'Mode',
        kind: {
          type: 'select',
          currentValue: 'default',
          choices: [
            { value: 'default', label: 'Default' },
            { value: 'plan', label: 'Plan' }
          ]
        },
        valueSource: 'applied',
        transport: 'agent-session',
        settable: true
      },
      {
        id: 'fastMode',
        label: 'Fast',
        kind: { type: 'boolean', currentValue: false },
        valueSource: 'applied',
        transport: 'agent-session',
        settable: true
      }
    ]
  })
  document.getElementById('input')?.focus()
  expect(handleRevioChatModeKey(key({ key: 'Tab', shiftKey: true }), composer)).toBe(true)
  expect(setOption).toHaveBeenCalledWith('interactionMode', 'plan')
  expect(
    handleRevioChatModeKey(key({ key: 'e', code: 'KeyE', metaKey: true, shiftKey: true }), composer)
  ).toBe(true)
  expect(setOption).toHaveBeenCalledWith('fastMode', true)
})

it('answers an approval with ↵, ⌘↵ and ⌫ only from an empty composer', () => {
  const { composer, clicks } = setup(true)
  document.getElementById('input')?.focus()
  expect(handleRevioChatModeKey(key({ key: 'Enter' }), composer)).toBe(true)
  expect(handleRevioChatModeKey(key({ key: 'Enter', metaKey: true }), composer)).toBe(true)
  expect(handleRevioChatModeKey(key({ key: 'Backspace' }), composer)).toBe(true)
  expect(clicks).toEqual(['Yes', 'Yes, session', 'No'])
  const input = document.getElementById('input')
  if (input) {
    input.textContent = 'typing'
  }
  expect(handleRevioChatModeKey(key({ key: 'Backspace' }), composer)).toBe(false)
})
