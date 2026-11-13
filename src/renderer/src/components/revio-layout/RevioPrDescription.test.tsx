// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RevioPrDescription } from './RevioPrDescription'

const repo = { id: 'r1', path: '/repo' }
const pr = { number: 7 }

function renderWithBody(body: string) {
  vi.stubGlobal('api', { gh: { prBody: vi.fn(async () => body), updatePRBody: vi.fn() } })
  return render(<RevioPrDescription repo={repo} pr={pr} />)
}

beforeEach(() => {
  document.documentElement.dataset.revioLayout = 'true'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.revioLayout
})

it('renders the PR description as markdown, not as its source', async () => {
  const view = renderWithBody('## Summary\n\n- adds a **probe** file\n- see `e2e-restart.txt`')
  await waitFor(() => expect(view.container.querySelector('li')).not.toBeNull())
  expect(view.container.querySelectorAll('li')).toHaveLength(2)
  expect(view.container.querySelector('strong')?.textContent).toBe('probe')
  expect(view.container.querySelector('code')?.textContent).toBe('e2e-restart.txt')
  expect(view.container.textContent).toContain('Summary')
  expect(view.container.textContent).not.toContain('##')
  expect(view.container.textContent).not.toContain('**')
})

it('says so when the PR has no description', async () => {
  const view = renderWithBody('  ')
  await waitFor(() => expect(view.container.textContent).toContain('No description provided.'))
})
