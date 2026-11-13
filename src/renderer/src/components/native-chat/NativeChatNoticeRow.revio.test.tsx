// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.revioLayout
})

const compaction = {
  type: 'text' as const,
  text: 'Context compacted',
  presentation: 'compaction' as const
}

it('names a compaction in the words in the workspace layout', () => {
  render(<NativeChatNoticeRow block={compaction} />)
  expect(screen.getByRole('separator').getAttribute('aria-label')).toBe('Context compacted')
  cleanup()
  document.documentElement.dataset.revioLayout = 'true'
  render(<NativeChatNoticeRow block={compaction} />)
  expect(screen.getByRole('separator').getAttribute('aria-label')).toBe('Chat history compacted')
})

it('a compaction that kept a summary offers Copy summary', () => {
  render(<NativeChatNoticeRow block={{ ...compaction, compactSummary: 'We fixed the parser.' }} />)
  expect(screen.getByRole('button', { name: 'Copy summary' })).toBeTruthy()
})
