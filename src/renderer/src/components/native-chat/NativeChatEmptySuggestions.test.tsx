// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatEmptySuggestions } from './NativeChatEmptySuggestions'

vi.mock('@/components/revio-layout/revio-layout', () => ({
  useRevioLayout: () => true
}))

afterEach(cleanup)

it("offers the layout's starter prompts and fills the chat input with one", () => {
  const exec = vi.fn(() => true)
  document.execCommand = exec
  render(
    <div data-native-chat-root="true">
      <NativeChatEmptySuggestions />
      <div data-native-chat-composer-scope="s">
        <div contentEditable="true" />
      </div>
    </div>
  )
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Review recent PRs',
    'Improve agent instructions',
    'Fix a TODO'
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Fix a TODO' }))
  expect(exec).toHaveBeenLastCalledWith(
    'insertText',
    false,
    'Find a small commented TODO and implement it.'
  )
})
