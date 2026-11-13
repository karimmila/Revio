// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatApprovalCard, openableAuthorizationUrl } from './NativeChatApprovalCard'

// The markdown and code renderers pull in wasm this card never needs for a URL prompt.
vi.mock('./NativeChatMarkdown', () => ({ NativeChatMarkdown: () => null }))
vi.mock('./NativeChatCodeBlock', () => ({ NativeChatCodeBlock: () => null }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const options = [
  { label: 'Continue', send: 'accept' },
  { label: 'Cancel', send: 'cancel' }
]

it('a URL elicitation opens its authorization page without answering', () => {
  const openUrl = vi.fn(async () => {})
  vi.stubGlobal('api', { shell: { openUrl } })
  const onChoose = vi.fn()
  render(
    <NativeChatApprovalCard
      approval={{ title: 'Sign in to Linear', authorizationUrl: 'https://example.com/a', options }}
      onChoose={onChoose}
    />
  )
  expect(screen.getByText('https://example.com/a')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Open authorization page' }))
  expect(openUrl).toHaveBeenCalledWith('https://example.com/a')
  expect(onChoose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(onChoose).toHaveBeenCalledWith('accept')
})

it('only web pages are offered to open', () => {
  expect(openableAuthorizationUrl('http://localhost:3000/cb')).toBe('http://localhost:3000/cb')
  expect(openableAuthorizationUrl('file:///etc/passwd')).toBeNull()
  expect(openableAuthorizationUrl('not a url')).toBeNull()
  expect(openableAuthorizationUrl(undefined)).toBeNull()
  render(
    <NativeChatApprovalCard
      approval={{ title: 'Sign in', authorizationUrl: 'javascript:alert(1)', options }}
      onChoose={vi.fn()}
    />
  )
  expect(screen.queryByRole('button', { name: 'Open authorization page' })).toBeNull()
})
