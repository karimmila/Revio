// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import type { GitHubWorkItemDetails } from '../../../../../shared/github/work-item-types'
import { workItemContextDocument } from './revio-hash-context-content'
import { attachWorkItemContext } from './revio-hash-context-attach'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))
const destination = vi.hoisted(() => vi.fn())
vi.mock('@/components/native-chat/native-chat-composer-destination', () => ({
  nativeChatComposerScopeDestination: destination
}))

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

const file = (path: string, additions: number, deletions: number) => ({
  path,
  status: 'modified' as const,
  additions,
  deletions,
  isBinary: false
})

const pr: GitHubWorkItemDetails = {
  item: {
    id: 'p',
    type: 'pr',
    number: 12,
    title: 'Fix login',
    state: 'draft',
    url: 'https://github.com/o/r/pull/12',
    labels: [],
    updatedAt: '',
    author: 'ana',
    branchName: 'fix-login',
    baseRefName: 'main'
  },
  body: 'Stops the redirect loop.\n',
  comments: [],
  files: [file('src/a.ts', 3, 1), { ...file('src/b.ts', 2, 0), oldPath: 'src/old.ts' }]
}

it('a PR gives its header, description and changed-file summary', () => {
  expect(workItemContextDocument(pr)).toBe(
    [
      '# Pull request #12: Fix login',
      '',
      '**GitHub URL:** https://github.com/o/r/pull/12',
      '**Status:** Draft',
      '**Branch:** fix-login → main',
      '**Author:** ana',
      '',
      '## Description',
      '',
      'Stops the redirect loop.',
      '',
      '## Changed files',
      '',
      '2 files, +5 -1',
      '',
      '- src/a.ts: modified, +3 -1',
      '- src/b.ts (from src/old.ts): modified, +2 -0'
    ].join('\n')
  )
})

it('an issue has no branch or files, and an empty body says so', () => {
  const issue = workItemContextDocument({
    ...pr,
    item: { ...pr.item, type: 'issue', state: 'open', author: null },
    body: ' '
  })
  expect(issue).toMatch(/^# Issue #12: Fix login/)
  expect(issue).toContain('**Status:** Open')
  expect(issue).not.toContain('Branch')
  expect(issue).not.toContain('Changed files')
  expect(issue).toContain('No description provided.')
})

it('a long file list stops at 50 and counts the rest', () => {
  const files = Array.from({ length: 53 }, (_, index) => file(`f${index}.ts`, 1, 0))
  const text = workItemContextDocument({ ...pr, files })
  expect(text).toContain('53 files, +53 -0')
  expect(text).toContain('- f49.ts')
  expect(text).not.toContain('- f50.ts')
  expect(text).toContain('- … and 3 more')
})

function composerInput(): HTMLElement {
  const scope = document.createElement('div')
  scope.setAttribute('data-native-chat-composer-scope', 'agent-session:s1')
  const input = document.createElement('div')
  scope.append(input)
  document.body.append(scope)
  return input
}

it('attaches the document to the chat that holds the input', async () => {
  const insertPastedText = vi.fn(() => true)
  destination.mockReturnValue({ insertPastedText })
  const read = vi.fn(async () => pr)
  expect(await attachWorkItemContext(composerInput(), pr.item, read)).toBe(true)
  expect(read).toHaveBeenCalledWith(pr.item)
  expect(destination).toHaveBeenCalledWith('agent-session:s1')
  expect(insertPastedText).toHaveBeenCalledWith(workItemContextDocument(pr), {
    asAttachment: true
  })
  expect(toastError).not.toHaveBeenCalled()
})

it('says "Failed to save PR context" when the details cannot be read', async () => {
  const insertPastedText = vi.fn(() => true)
  destination.mockReturnValue({ insertPastedText })
  const read = vi.fn(async () => {
    throw new Error('gh')
  })
  expect(await attachWorkItemContext(composerInput(), pr.item, read)).toBe(false)
  expect(insertPastedText).not.toHaveBeenCalled()
  expect(toastError).toHaveBeenCalledWith('Failed to save PR context')
})
