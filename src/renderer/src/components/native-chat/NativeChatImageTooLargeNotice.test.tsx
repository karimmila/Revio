// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'
import { isImageTooLargeFailure } from './NativeChatImageTooLargeNotice'

afterEach(cleanup)

it('spots Claude Code’s 5 MB image refusal', () => {
  expect(
    isImageTooLargeFailure('API Error: 400 messages.0.content.1.image: image exceeds 5 MB maximum')
  ).toBe(true)
  expect(isImageTooLargeFailure('Request failed', null)).toBe(false)
})

it('an error row about it adds "Image too large"', () => {
  render(
    <NativeChatNoticeRow
      block={{ type: 'text', text: 'API Error: image exceeds 5 MB maximum', tone: 'error' }}
    />
  )
  expect(screen.getByText('Image too large')).toBeTruthy()
})
