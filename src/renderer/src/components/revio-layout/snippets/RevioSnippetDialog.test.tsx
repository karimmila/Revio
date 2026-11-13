// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { RevioSnippetDialog } from './RevioSnippetDialog'
import { requestSnippetInsert } from './revio-snippet-insert'

afterEach(cleanup)

const snippet = { id: 's1', name: 'Write tests', keyword: 'tests', body: 'Add unit tests.' }

function openFor(): HTMLElement {
  const input = document.createElement('div')
  input.setAttribute('contenteditable', 'true')
  document.body.append(input)
  act(() => requestSnippetInsert(input))
  return input
}

it('⌘; picks a snippet into the chat input', async () => {
  const updateSettings = vi.fn(async () => {})
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings!, revioPromptSnippets: [snippet] },
    updateSettings
  })
  const exec = vi.fn(() => true)
  document.execCommand = exec
  render(<RevioSnippetDialog />)
  openFor()
  const search = screen.getByPlaceholderText('Search snippets...')
  fireEvent.change(search, { target: { value: ';te' } })
  fireEvent.keyDown(search, { key: 'Enter' })
  await vi.waitFor(() => expect(exec).toHaveBeenCalledWith('insertText', false, 'Add unit tests.'))
})

it('Create snippet saves name, keyword and body to settings', () => {
  const updateSettings = vi.fn(async () => {})
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings!, revioPromptSnippets: [] },
    updateSettings
  })
  render(<RevioSnippetDialog />)
  openFor()
  fireEvent.click(screen.getByRole('button', { name: 'Create snippet' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bug' } })
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'bu g;' } })
  fireEvent.change(screen.getByLabelText('Prompt snippet'), { target: { value: 'Fix it' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(updateSettings).toHaveBeenCalledWith({
    revioPromptSnippets: [expect.objectContaining({ name: 'Bug', keyword: 'bug', body: 'Fix it' })]
  })
})
