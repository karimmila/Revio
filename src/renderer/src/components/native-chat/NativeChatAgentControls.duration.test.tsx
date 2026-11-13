// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatAgentControls } from './NativeChatTranscriptChrome'

const NOW = Date.UTC(2026, 0, 15, 12)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  delete document.documentElement.dataset.revioLayout
})

it('the answer footer names the turn duration before the time in the workspace layout', () => {
  document.documentElement.dataset.revioLayout = 'true'
  render(
    <TooltipProvider>
      <NativeChatAgentControls
        markdown="Done"
        timestamp={NOW}
        workedSeconds={690}
        onScrollToTop={vi.fn()}
      />
    </TooltipProvider>
  )
  expect(screen.getByText(/11m/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Copy final message' })).toBeTruthy()
})
