// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatTableOfContents, tableOfContentsSummary } from './NativeChatTableOfContents'

afterEach(cleanup)

const item = (id: string, text: string, hasImages = false) => ({
  id,
  slotIndex: 0,
  text,
  hasImages
})

it("words each entry the way the layout's table of contents does", () => {
  expect(tableOfContentsSummary(item('a', 'Fix the login loop'))).toBe('Fix the login loop')
  expect(tableOfContentsSummary(item('a', 'x'.repeat(70)))).toBe(`${'x'.repeat(60)}...`)
  expect(tableOfContentsSummary(item('a', '/compact'))).toBe('Compacting')
  expect(tableOfContentsSummary(item('a', ''))).toBe('Empty message')
  expect(tableOfContentsSummary(item('a', '', true))).toBe('Image attachment')
})

it('lists every message on hover, marks the current one, and a pick jumps to it', async () => {
  const onSelect = vi.fn()
  const items = [item('a', 'First ask'), item('b', 'Second ask')]
  render(<NativeChatTableOfContents items={items} activeId="b" onSelect={onSelect} />)
  const trigger = screen.getByRole('button', { name: 'Table of contents' })
  fireEvent.pointerEnter(trigger)
  fireEvent.focus(trigger)
  const second = await screen.findByRole('button', { name: 'Second ask' })
  expect(second.getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('button', { name: 'First ask' }).getAttribute('aria-current')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'First ask' }))
  expect(onSelect).toHaveBeenCalledWith(items[0])
})

it('shows nothing in an empty chat', () => {
  render(<NativeChatTableOfContents items={[]} activeId={null} onSelect={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Table of contents' })).toBeNull()
})
