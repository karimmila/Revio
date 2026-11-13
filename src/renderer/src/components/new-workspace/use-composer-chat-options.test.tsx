// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import { useComposerChatOptions } from './use-composer-chat-options'

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
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Med' },
          { value: 'high', label: 'High' }
        ]
      },
      { id: 'sonnet', label: 'Sonnet 5.5', efforts: [{ value: 'high', label: 'High' }] }
    ]
  })
}))

function shown(
  snapshot: ReturnType<typeof useComposerChatOptions>['snapshot'],
  id: string
): string | undefined {
  const option = snapshot.find((descriptor) => descriptor.id === id)
  return option?.kind.type === 'select' ? option.kind.currentValue : undefined
}

it('shows the saved default model and effort, and returns only what was picked', async () => {
  useAppStore.setState({
    settings: {
      ...getDefaultSettings('/home/test'),
      nativeChatSessionOptions: {
        claude: { model: 'opus', valuesByModel: { opus: { effort: 'medium' } } }
      }
    }
  })
  const initialProps: { agent: 'claude' | 'codex' } = { agent: 'claude' }
  const { result, rerender } = renderHook(({ agent }) => useComposerChatOptions(agent), {
    initialProps
  })
  // The host's listing lands after the first frame, with every model and its efforts.
  await waitFor(() =>
    expect(result.current.snapshot.find((option) => option.id === 'effort')?.settable).toBe(true)
  )
  expect(shown(result.current.snapshot, 'model')).toBe('opus')
  expect(shown(result.current.snapshot, 'effort')).toBe('medium')
  expect(result.current.picks).toEqual({})
  await act(async () => {
    await result.current.surface.setOption('effort', 'high')
  })
  expect(result.current.picks).toEqual({ effort: 'high' })
  expect(shown(result.current.snapshot, 'effort')).toBe('high')
  rerender({ agent: 'codex' })
  expect(result.current.picks).toEqual({})
})
