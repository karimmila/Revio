// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { NativeChatLoadoutRows } from './NativeChatLoadoutRows'

afterEach(cleanup)

it('saves the current set and lists loadouts with their keys', () => {
  const updateSettings = vi.fn(async () => {})
  const saved = { id: 'a', agent: 'claude', model: 'opus', label: 'Opus' }
  useAppStore.setState({
    settings: {
      ...useAppStore.getState().settings!,
      revioLayout: true,
      revioLoadouts: [saved]
    },
    updateSettings
  })
  render(
    <NativeChatLoadoutRows
      current={{ agent: 'claude', model: 'sonnet', effort: 'low', label: 'Sonnet · Low' }}
      onPicked={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: /^Opus/ }).textContent).toMatch(/1$/)
  fireEvent.click(screen.getByRole('button', { name: 'Save as loadout' }))
  expect(updateSettings).toHaveBeenCalledWith({
    revioLoadouts: [saved, expect.objectContaining({ model: 'sonnet', effort: 'low' })]
  })
  fireEvent.click(screen.getByRole('button', { name: 'Remove loadout' }))
  expect(updateSettings).toHaveBeenLastCalledWith({ revioLoadouts: [] })
})
