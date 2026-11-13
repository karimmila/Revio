// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatPastPlans } from './NativeChatPastPlans'
import {
  newestPlans,
  pastPlanAttachmentText,
  planFileNames,
  planTitle,
  workspacePlansDir
} from './native-chat-past-plans'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const entry = (name: string, isDirectory = false) => ({ name, isDirectory, isSymlink: false })

it("reads the layout's .context/plans markdown files, newest first", () => {
  expect(workspacePlansDir('/w/')).toBe('/w/.context/plans')
  expect(planFileNames([entry('a.md'), entry('notes.txt'), entry('old', true)])).toEqual(['a.md'])
  expect(planTitle('fix-login_loop.md')).toBe('Fix login loop')
  const plans = [1, 4, 2, 3].map((mtime) => ({ title: `p${mtime}`, filePath: `/p${mtime}`, mtime }))
  expect(newestPlans(plans).map((plan) => plan.title)).toEqual(['p4', 'p3', 'p2'])
  expect(pastPlanAttachmentText({ title: 'Fix', filePath: '/w/.context/plans/fix.md' })).toBe(
    'Plan "Fix" — file: /w/.context/plans/fix.md '
  )
})

it('offers them under "Add plans:" and hands a pick its words', async () => {
  vi.stubGlobal('api', {
    fs: {
      pathExists: vi.fn(async () => true),
      readDir: vi.fn(async () => [entry('fix-login.md')]),
      stat: vi.fn(async () => ({ size: 1, isDirectory: false, mtime: 5 }))
    }
  })
  const onPick = vi.fn()
  render(<NativeChatPastPlans workspacePath="/w" onPick={onPick} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Fix login' }))
  expect(screen.getByText('Add plans:')).toBeTruthy()
  expect(onPick).toHaveBeenCalledWith(
    expect.anything(),
    'Plan "Fix login" — file: /w/.context/plans/fix-login.md '
  )
})

it('shows nothing when the workspace has no plans folder', async () => {
  const pathExists = vi.fn(async () => false)
  const readDir = vi.fn()
  vi.stubGlobal('api', { fs: { pathExists, readDir, stat: vi.fn() } })
  render(<NativeChatPastPlans workspacePath="/w" onPick={vi.fn()} />)
  await vi.waitFor(() => expect(pathExists).toHaveBeenCalled())
  expect(readDir).not.toHaveBeenCalled()
  expect(screen.queryByText('Add plans:')).toBeNull()
})
