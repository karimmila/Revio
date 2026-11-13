// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import {
  clearSubmittedNewWorkspacePromptDraft,
  markNewWorkspacePromptDraftSubmitted,
  readNewWorkspacePromptDraft,
  resetNewWorkspacePromptDraftsForTests,
  useNewWorkspacePromptDraft,
  writeNewWorkspacePromptDraft,
  type ComposerLocation
} from './new-workspace-prompt-draft'

afterEach(() => {
  localStorage.clear()
  resetNewWorkspacePromptDraftsForTests()
})

it('keeps one draft per location and survives a reload from storage', () => {
  writeNewWorkspacePromptDraft('cloud', 'fix the login bug')
  writeNewWorkspacePromptDraft('mac', 'local idea')
  resetNewWorkspacePromptDraftsForTests()
  expect(readNewWorkspacePromptDraft('cloud')).toBe('fix the login bug')
  expect(readNewWorkspacePromptDraft('mac')).toBe('local idea')
})

it('clears only the draft a successful create was made from', () => {
  writeNewWorkspacePromptDraft('cloud', 'cloud task')
  writeNewWorkspacePromptDraft('mac', 'mac task')
  clearSubmittedNewWorkspacePromptDraft()
  expect(readNewWorkspacePromptDraft('cloud')).toBe('cloud task')
  markNewWorkspacePromptDraftSubmitted('cloud')
  clearSubmittedNewWorkspacePromptDraft()
  expect(readNewWorkspacePromptDraft('cloud')).toBe('')
  expect(readNewWorkspacePromptDraft('mac')).toBe('mac task')
})

it('works in memory when storage throws', () => {
  const original = Storage.prototype.setItem
  Storage.prototype.setItem = () => {
    throw new Error('quota')
  }
  try {
    writeNewWorkspacePromptDraft('mac', 'kept in memory')
    expect(readNewWorkspacePromptDraft('mac')).toBe('kept in memory')
  } finally {
    Storage.prototype.setItem = original
  }
})

it('saves typing and swaps to the other location draft on a switch', () => {
  writeNewWorkspacePromptDraft('mac', 'mac text')
  const shown: string[] = []
  const initialProps: { location: ComposerLocation; prompt: string } = {
    location: 'cloud',
    prompt: ''
  }
  const { rerender } = renderHook(
    ({ location, prompt }: { location: ComposerLocation; prompt: string }) =>
      useNewWorkspacePromptDraft(location, prompt, (text) => shown.push(text)),
    { initialProps }
  )
  rerender({ location: 'cloud', prompt: 'cloud text' })
  expect(readNewWorkspacePromptDraft('cloud')).toBe('cloud text')
  act(() => rerender({ location: 'mac', prompt: 'cloud text' }))
  expect(shown).toEqual(['mac text'])
  expect(readNewWorkspacePromptDraft('mac')).toBe('mac text')
  expect(readNewWorkspacePromptDraft('cloud')).toBe('cloud text')
})
