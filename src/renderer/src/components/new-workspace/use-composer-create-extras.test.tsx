// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import {
  readNewWorkspacePromptDraft,
  resetNewWorkspacePromptDraftsForTests,
  writeNewWorkspacePromptDraft
} from '@/lib/new-workspace-prompt-draft'
import { afterCreate, useComposerCreateExtras } from './use-composer-create-extras'

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: async () => ({
    origin: 'probe',
    fetchedAt: 1,
    models: [
      {
        id: 'opus',
        label: 'Opus 5.5',
        isDefault: true,
        defaultEffort: 'medium',
        efforts: [
          { value: 'medium', label: 'Med' },
          { value: 'high', label: 'High' }
        ]
      }
    ]
  })
}))

afterEach(() => {
  localStorage.clear()
  resetNewWorkspacePromptDraftsForTests()
})

it('adds the pill picks to both launch inputs and clears the used draft after a create', async () => {
  useAppStore.setState({
    settings: {
      ...getDefaultSettings('/home/test'),
      revioLocation: 'cloud',
      nativeChatSessionOptions: { claude: { model: 'opus', valuesByModel: {} } }
    }
  })
  writeNewWorkspacePromptDraft('cloud', 'ship it')
  const submit = vi.fn(async () => {})
  const { result } = renderHook(() =>
    useComposerCreateExtras('claude', { agentPrompt: 'ship it' }, submit)
  )
  await waitFor(() =>
    expect(
      result.current.chatOptions.snapshot.find((option) => option.id === 'effort')?.settable
    ).toBe(true)
  )
  await act(async () => {
    await result.current.chatOptions.surface.setOption('effort', 'high')
  })
  await result.current.submitQuick('claude', {
    launchInputs: { sessionOptions: { model: 'opus' } }
  })
  // Cloud: the shown model rides along, since the sandbox's account default can differ.
  expect(submit).toHaveBeenCalledWith('claude', {
    launchInputs: {
      sessionOptions: { model: 'opus', effort: 'high' },
      chatSessionOptions: { model: 'opus', effort: 'high' }
    }
  })
  const close = vi.fn()
  afterCreate(close)()
  expect(close).toHaveBeenCalled()
  expect(readNewWorkspacePromptDraft('cloud')).toBe('')
})

it('leaves a Mac launch untouched when nothing was picked', async () => {
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home/test'), revioLocation: 'local' }
  })
  const submit = vi.fn(async () => {})
  const { result } = renderHook(() => useComposerCreateExtras('claude', {}, submit))
  await result.current.submitQuick('claude', { setupOnly: false })
  expect(submit).toHaveBeenCalledWith('claude', { setupOnly: false })
})

it('sends the listed default model on a cloud create made before the pill showed one', async () => {
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home/test'), revioLocation: 'cloud' }
  })
  const submit = vi.fn(async () => {})
  const { result } = renderHook(() => useComposerCreateExtras('claude', {}, submit))
  await result.current.submitQuick('claude', {})
  expect(submit).toHaveBeenCalledWith('claude', {
    launchInputs: {
      sessionOptions: { model: 'opus', effort: 'medium' },
      chatSessionOptions: { model: 'opus', effort: 'medium' }
    }
  })
})
