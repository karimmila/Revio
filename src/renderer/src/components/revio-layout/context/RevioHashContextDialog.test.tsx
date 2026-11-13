// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RevioHashContextDialog } from './RevioHashContextDialog'
import { REVIO_HASH_CONTEXT_EVENT, workItemContextText } from './revio-hash-context'

const search = vi.hoisted(() => vi.fn())
vi.mock('./revio-hash-context-search', () => ({
  searchWorkItems: search,
  readWorkItemDetails: vi.fn(async () => null)
}))

afterEach(cleanup)

const pr = { id: 'p', type: 'pr' as const, number: 12, title: 'Fix login', url: 'https://gh/pr/12' }

it('words a PR or issue for the prompt', () => {
  expect(workItemContextText(pr)).toBe('PR #12 "Fix login" (https://gh/pr/12) ')
  expect(workItemContextText({ ...pr, type: 'issue' })).toMatch(/^Issue #12/)
})

it('# lists open PRs and issues of the repo and puts the pick in the input', async () => {
  search.mockResolvedValue([pr])
  const exec = vi.fn(() => true)
  document.execCommand = exec
  render(<RevioHashContextDialog />)
  const input = document.createElement('div')
  document.body.append(input)
  act(() => {
    window.dispatchEvent(new CustomEvent(REVIO_HASH_CONTEXT_EVENT, { detail: input }))
  })
  fireEvent.click(await screen.findByText('Fix login', {}, { timeout: 2000 }))
  expect(search).toHaveBeenCalledWith('')
  await vi.waitFor(() =>
    expect(exec).toHaveBeenCalledWith('insertText', false, 'PR #12 "Fix login" (https://gh/pr/12) ')
  )
})
