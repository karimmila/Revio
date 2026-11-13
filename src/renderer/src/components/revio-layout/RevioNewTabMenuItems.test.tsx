// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { readAgentSessionHistoryModalRequest } from '@/components/right-sidebar/ai-vault/panel/agent-session-history-modal'
import { RevioNewTabMenuItems } from './RevioNewTabMenuItems'

vi.mock('./launch-revio-chat', () => ({ launchRevioChat: vi.fn() }))

afterEach(cleanup)

it('"View chat history" opens the workspace history, picking into a new tab', () => {
  const openModal = vi.fn()
  useAppStore.setState({ openModal })
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <RevioNewTabMenuItems
          worktreeId="r::/w"
          groupId={undefined}
          browserEnabled={false}
          newChatShortcut="⌘T"
          newBrowserShortcut=""
          onNewBrowserTab={vi.fn()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  fireEvent.click(screen.getByRole('menuitem', { name: 'View chat history' }))
  expect(openModal).toHaveBeenCalledWith(
    'agent-session-history',
    expect.objectContaining({ worktreeId: 'r::/w', chatTabId: null })
  )
  const data = openModal.mock.calls[0]![1]
  expect(readAgentSessionHistoryModalRequest(data)?.chatTabId).toBeNull()
})

it('offers no terminal in the center: terminals open in the bottom panel', () => {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <RevioNewTabMenuItems
          worktreeId="r::/w"
          groupId={undefined}
          browserEnabled
          newChatShortcut="⌘T"
          newBrowserShortcut="⌘B"
          onNewBrowserTab={vi.fn()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Chat⌘T',
    'Browser⌘B',
    'View chat history'
  ])
  expect(screen.queryByText(/terminal/i)).toBeNull()
})

it('shows no key hint for the Browser item while its shortcut is unassigned', () => {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <RevioNewTabMenuItems
          worktreeId="r::/w"
          groupId={undefined}
          browserEnabled
          newChatShortcut="⌘T"
          newBrowserShortcut="Unassigned"
          onNewBrowserTab={vi.fn()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Chat⌘T',
    'Browser',
    'View chat history'
  ])
})
