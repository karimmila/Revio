// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatThreadGoalBanner } from './NativeChatThreadGoalBanner'

afterEach(cleanup)

it('Edit goal puts the goal command in the chat input', () => {
  const exec = vi.fn(() => true)
  document.execCommand = exec
  render(
    <TooltipProvider>
      <div data-native-chat-root="true">
        <NativeChatThreadGoalBanner
          goal={{
            objective: 'Ship the parser',
            status: 'active',
            tokenBudget: null,
            tokensUsed: 0,
            timeUsedSeconds: 0,
            createdAt: 0,
            updatedAt: 0
          }}
          pending={false}
          hostChanges
          sendUnavailable={false}
          isVisible
          runningTurn={null}
          onChange={vi.fn()}
        />
        <div data-native-chat-composer-scope="s">
          <div contentEditable="true" />
        </div>
      </div>
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }))
  expect(exec).toHaveBeenLastCalledWith('insertText', false, '/goal Ship the parser')
})
