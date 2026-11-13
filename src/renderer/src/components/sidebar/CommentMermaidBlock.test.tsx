// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CommentMermaidBlock from './CommentMermaidBlock'

vi.mock('@/components/editor/MermaidBlock', () => ({ default: () => <div /> }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('copies the Mermaid source', () => {
  const write = vi.fn(async () => {})
  vi.stubGlobal('api', { ui: { writeClipboardText: write } })
  render(<CommentMermaidBlock content="graph TD; A-->B" />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy Mermaid source' }))
  expect(write).toHaveBeenCalledWith('graph TD; A-->B')
})
