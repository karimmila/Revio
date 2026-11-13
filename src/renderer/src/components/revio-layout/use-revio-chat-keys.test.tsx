// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { useRevioChatKeys } from './use-revio-chat-keys'

const launch = vi.hoisted(() => vi.fn(() => true))
vi.mock('./launch-revio-chat', () => ({ requestRevioReview: launch }))
vi.mock('@/store/slices/worktree-helpers', () => ({
  findWorktreeById: (_byRepo: unknown, id: string) => ({ id, path: '/w' })
}))

function press(code: string, shift = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    metaKey: true,
    shiftKey: shift,
    bubbles: true,
    cancelable: true
  })
  window.dispatchEvent(event)
  return event
}

let modelClicks = 0
let attachClicks = 0
beforeEach(() => {
  modelClicks = 0
  attachClicks = 0
  document.body.innerHTML = `<div data-native-chat-composer-scope="s">
    <div contenteditable="true"></div>
    <button id="model"><span data-composer-label>Opus</span></button>
    <button id="attach" data-native-chat-attach></button>
  </div>`
  // happy-dom lays nothing out; the shown composer is the one with a width.
  const composer = document.querySelector<HTMLElement>('[data-native-chat-composer-scope]')!
  composer.getBoundingClientRect = () => new DOMRect(0, 0, 400, 20)
  document.getElementById('model')!.addEventListener('click', () => modelClicks++)
  document.getElementById('attach')!.addEventListener('click', () => attachClicks++)
  useAppStore.setState({
    activeView: 'terminal',
    activeTabType: 'terminal',
    activeWorktreeId: 'r::/w'
  })
})
afterEach(() => {
  document.body.innerHTML = ''
})

it("runs the layout's chat keys on the chat on screen", () => {
  renderHook(() => useRevioChatKeys())
  expect(press('KeyL').defaultPrevented).toBe(true)
  expect(document.activeElement?.getAttribute('contenteditable')).toBe('true')
  press('Slash')
  expect(modelClicks).toBe(1)
  press('KeyU')
  expect(attachClicks).toBe(1)
  const openAllDiffs = vi.fn()
  useAppStore.setState({ openAllDiffs })
  press('KeyD', true)
  expect(openAllDiffs).toHaveBeenCalledWith('r::/w', '/w')
  press('KeyR', true)
  expect(launch).toHaveBeenCalledWith('r::/w')
})

it('leaves ⌘L to a browser tab', () => {
  useAppStore.setState({ activeTabType: 'browser' })
  renderHook(() => useRevioChatKeys())
  expect(press('KeyL').defaultPrevented).toBe(false)
})

it('opens the "Open in" menu on ⌘⇧O', () => {
  const opened = vi.fn()
  window.addEventListener('orca:revio-open-in-menu', opened)
  renderHook(() => useRevioChatKeys())
  expect(press('KeyO', true).defaultPrevented).toBe(true)
  expect(opened).toHaveBeenCalled()
  window.removeEventListener('orca:revio-open-in-menu', opened)
})

it('⌘I opens the workspace link field (Linear when connected); ⌘⇧V pastes copied files as paths in the input', async () => {
  const openModal = vi.fn()
  useAppStore.setState({ openModal, linearStatus: { connected: true, viewer: null } })
  renderHook(() => useRevioChatKeys())
  expect(press('KeyI').defaultPrevented).toBe(true)
  expect(openModal).toHaveBeenCalledWith(
    'edit-meta',
    expect.objectContaining({ focus: 'issue', linkKind: 'linear-issue' })
  )
  const read = vi.fn(async () => ['/a b.png'])
  vi.stubGlobal('api', { ui: { readClipboardFilePaths: read } })
  document.execCommand = vi.fn(() => true)
  expect(press('KeyV', true).defaultPrevented).toBe(false)
  document.querySelector<HTMLElement>('[contenteditable]')!.focus()
  expect(press('KeyV', true).defaultPrevented).toBe(true)
  await vi.waitFor(() =>
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '"/a b.png"')
  )
  vi.unstubAllGlobals()
})
