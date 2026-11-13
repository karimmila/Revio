// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { SortableTabContextMenu } from './SortableTabContextMenu'

const noop = (): void => {}

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.revioLayout
})

function openMenu(): void {
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button type="button">Tab</button>
      </ContextMenuTrigger>
      <SortableTabContextMenu
        open
        tab={{ id: 'tab-1', worktreeId: 'wt-1', color: null }}
        unifiedTabId="tab-1"
        groupId="group-1"
        isActive
        tabCount={1}
        hasTabsToRight={false}
        hasTabsToLeft={false}
        isPinned={false}
        canToggleViewMode
        isChatView
        onToggleViewMode={noop}
        onActivate={noop}
        onClose={noop}
        onCloseOthers={noop}
        onCloseToRight={noop}
        onCloseToLeft={noop}
        onRenameOpen={noop}
        onSetTabColor={noop}
        onTogglePin={noop}
      />
    </ContextMenu>
  )
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Tab' }))
}

describe('SortableTabContextMenu terminal hand-off', () => {
  it('offers "Continue with Terminal Agent" in the classic layout', () => {
    openMenu()
    expect(screen.getByRole('menuitem', { name: 'Continue with Terminal Agent' })).toBeTruthy()
  })

  it('offers no terminal hand-off in the workspace layout, whose center holds chats only', () => {
    document.documentElement.dataset.revioLayout = 'true'
    openMenu()
    expect(screen.getByRole('menuitem', { name: /Pin Tab/ })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Continue with Terminal Agent' })).toBeNull()
  })
})
