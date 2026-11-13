// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatMessageActionsButton } from './NativeChatMessageActionsButton'

afterEach(cleanup)

it('opens the message menu through a context-menu event at the button', () => {
  const onContextMenu = vi.fn()
  render(
    <div onContextMenu={onContextMenu}>
      <NativeChatMessageActionsButton />
    </div>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show message actions' }))
  expect(onContextMenu).toHaveBeenCalledOnce()
})
