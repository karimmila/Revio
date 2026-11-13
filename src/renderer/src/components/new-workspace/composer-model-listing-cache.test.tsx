// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useComposerChatOptions } from './use-composer-chat-options'
import { cachedModelListing, rememberModelListing } from './composer-model-listing-cache'
import { nativeChatModelPillLabel } from '../../../../shared/native-chat/input/native-chat-session-option-labels'

vi.mock('@/runtime/structured-agent-session-client', () => ({
  // The host is still listing: no answer arrives during these tests.
  callStructuredAgentSession: () => new Promise(() => {})
}))
vi.mock('@/runtime/structured-agent-session-owner', () => ({
  structuredAgentSessionTargetForHost: () => ({ kind: 'local' })
}))

const LISTING = {
  origin: 'probe' as const,
  fetchedAt: 1,
  listingNamesConfiguredModel: true,
  models: [
    {
      id: 'opus',
      label: 'Opus 5.5',
      isDefault: true,
      defaultEffort: 'medium',
      efforts: [{ value: 'medium', label: 'Medium' }]
    }
  ]
}

beforeEach(() => localStorage.clear())

it('names the default model from the last listing before this run’s listing arrives', () => {
  rememberModelListing('claude', LISTING)
  const { result } = renderHook(() => useComposerChatOptions('claude'))
  const model = result.current.snapshot.find((option) => option.id === 'model')
  expect(model && nativeChatModelPillLabel(model, (key) => key)).toBe('Opus 5.5')
  expect(result.current.shown.model).toBe('opus')
})

it('keeps listings per agent and ignores stored junk', () => {
  localStorage.setItem('orca.composerModelListings', '{"codex":{"models":"no"}}')
  expect(cachedModelListing('codex')).toBeNull()
  rememberModelListing('claude', LISTING)
  expect(cachedModelListing('claude')?.origin).toBe('probe')
  expect(cachedModelListing('codex')).toBeNull()
})
