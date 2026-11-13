import { useEffect } from 'react'
import { useNarrowWindowPanels } from './narrow-window-panels'
import { useRevioDockOpenPersistence } from './revio-dock-open-persistence'
import { useAppStore } from '@/store'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import {
  canMoveTabToNewPaneColumn,
  moveTabToNewPaneColumn
} from '@/components/tab-bar/tab-move-to-pane-column'
import { confirmOpenDialog } from './revio-dialog-confirm'
import { REVIO_SHORTCUTS_OVERLAY_EVENT } from './RevioShortcutsOverlay'
import { openAppFeedback } from '@/lib/app-feedback-entry'
import {
  REVIO_SEND_FEEDBACK_EVENT,
  revioAppKeyFor,
  nextZenLayout,
  toggledTheme,
  type RevioAppKey,
  type SidebarPair
} from './revio-app-keys'

let zenSaved: SidebarPair | null = null

function focusInEditor(): boolean {
  const focus = document.activeElement
  return focus instanceof HTMLElement && focus.closest('.monaco-editor') !== null
}

/** The create card mounts lazily; once it shows, its own ⌘I opens "Create from". */
function openCreateFromWhenCardShows(triesLeft = 30): void {
  if (document.querySelector('[data-revio-composer-model]')) {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', metaKey: true, bubbles: true })
    )
    return
  }
  if (triesLeft > 0) {
    window.setTimeout(() => openCreateFromWhenCardShows(triesLeft - 1), 50)
  }
}

/**
 * ⌘D "Split tab": the tab on screen moves to a new pane on the right. Terminals keep
 * ⌘D for their own split, and the file editor keeps it for its next-match selection.
 */
function splitActiveTab(): boolean {
  const focus = document.activeElement
  if (focus instanceof HTMLElement && focus.closest('.xterm, .monaco-editor')) {
    return false
  }
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  if (!worktreeId || state.activeView !== 'terminal' || state.activeTabType === 'terminal') {
    return false
  }
  const groups = state.groupsByWorktree[worktreeId] ?? []
  const groupId = state.activeGroupIdByWorktree[worktreeId] ?? groups[0]?.id
  const tabId = groups.find((group) => group.id === groupId)?.activeTabId
  if (!groupId || !tabId || !canMoveTabToNewPaneColumn(tabId, groupId)) {
    return false
  }
  moveTabToNewPaneColumn({ unifiedTabId: tabId, groupId, direction: 'right' })
  return true
}

/** Returns false when the key should keep its usual meaning here. */
function runRevioAppKey(action: RevioAppKey): boolean {
  const state = useAppStore.getState()
  switch (action) {
    case 'openKeyboardShortcuts':
      window.dispatchEvent(new Event(REVIO_SHORTCUTS_OVERLAY_EVENT))
      return true
    case 'home':
      state.setActiveView('terminal')
      state.setActiveWorktree(null)
      return true
    case 'toggleTheme': {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      void state.updateSettings({
        theme: toggledTheme(state.settings?.theme ?? 'system', prefersDark)
      })
      return true
    }
    case 'addRepository':
      state.openModal('add-repo')
      return true
    case 'sendFeedback':
      // The file editor keeps ⌘⌥F for Replace.
      if (focusInEditor()) {
        return false
      }
      return openAppFeedback(() => window.dispatchEvent(new Event(REVIO_SEND_FEEDBACK_EVENT)))
    case 'createFrom':
      openWorkspaceCreationComposerWithTourHandoff()
      openCreateFromWhenCardShows()
      return true
    case 'splitTab':
      return splitActiveTab()
    case 'toggleZenMode': {
      const result = nextZenLayout(
        { left: state.sidebarOpen, right: state.rightSidebarOpen },
        zenSaved
      )
      zenSaved = result.saved
      state.setSidebarOpen(result.next.left)
      state.setRightSidebarOpen(result.next.right)
      return true
    }
  }
}

/** The app and navigation keys, anywhere in the workspace layout. */
export function RevioAppKeys(): null {
  useNarrowWindowPanels()
  useRevioDockOpenPersistence()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = revioAppKeyFor(event)
      if (action && runRevioAppKey(action)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    // Bubble phase, so a field inside the dialog that uses ⌘↵ itself handles it first.
    const onConfirmKey = (event: KeyboardEvent): void => {
      if (
        !event.defaultPrevented &&
        event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.ctrlKey &&
        event.key === 'Enter' &&
        confirmOpenDialog()
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keydown', onConfirmKey)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keydown', onConfirmKey)
    }
  }, [])
  return null
}
