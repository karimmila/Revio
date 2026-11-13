// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  NativeChatAutoAcceptEditsToggle,
  autoAcceptEditsToggleState
} from './NativeChatAutoAcceptEditsToggle'

afterEach(cleanup)

it('flips only between asking and accepting edits', () => {
  const modes = ['ask', 'accept-edits', 'auto', 'full-access'] as const
  expect(autoAcceptEditsToggleState('ask', modes)).toEqual({ on: false, next: 'accept-edits' })
  expect(autoAcceptEditsToggleState('accept-edits', modes)).toEqual({ on: true, next: 'ask' })
  expect(autoAcceptEditsToggleState('full-access', modes)).toBeNull()
  expect(autoAcceptEditsToggleState('ask', ['ask', 'full-access'])).toBeNull()
})

it('is a pressed button named "Auto-accept edits"', () => {
  const onToggle = vi.fn()
  render(<NativeChatAutoAcceptEditsToggle on disabled={false} onToggle={onToggle} />)
  const button = screen.getByRole('button', { name: 'Auto-accept edits' })
  expect(button.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(button)
  expect(onToggle).toHaveBeenCalledOnce()
})
