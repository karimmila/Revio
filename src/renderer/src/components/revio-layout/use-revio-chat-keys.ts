import { nativeChatTabActions } from '@/components/native-chat/native-chat-tab-actions'
import { copyRevioChatTranscript } from './RevioChatTabMenuItems'
import { copyRevioLink } from './RevioLinkRouter'
import { REVIO_OPEN_IN_MENU_EVENT } from './RevioBreadcrumbBar'
import { Fragment, createElement, useEffect } from 'react'
import { useAppStore } from '@/store'
import { requestRevioReview } from './launch-revio-chat'
import { handleRevioDiffKey } from './revio-diff-keys'
import { handleRevioCommentKey } from './revio-comment-nav'
import { revioDiffEditMode, setRevioDiffEditMode } from './revio-diff-view-store'
import { openWorktreePath } from '@/components/sidebar/workspace-actions/open/WorktreeOpenInMenu'
import { handleRevioChatModeKey } from './revio-chat-mode-keys'
import { pasteCopiedFilePaths } from './revio-paste-file-paths'
import { runUltracodeCommand } from './revio-ultracode'
import { requestSnippetInsert } from './snippets/revio-snippet-insert'
import { RevioSnippetDialog } from './snippets/RevioSnippetDialog'
import { expandSnippetKeyword } from './snippets/revio-snippet-keyword'
import { REVIO_HASH_CONTEXT_EVENT, typedHashStartsWord } from './context/revio-hash-context'
import { RevioHashContextDialog } from './context/RevioHashContextDialog'
import { applyRevioLoadout, revioLoadoutSlot } from './loadouts/apply-revio-loadout'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

function visible(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.getBoundingClientRect().width > 0
}

/** The chat composer on screen: hidden tabs keep theirs mounted at zero size. */
function shownComposer(): HTMLElement | null {
  return [...document.querySelectorAll('[data-native-chat-composer-scope]')].find(visible) ?? null
}

function composerInput(composer: HTMLElement): HTMLElement | null {
  return composer.querySelector<HTMLElement>('[contenteditable="true"]')
}

/** ⌘⇧/: the next effort level, through the picker the chat already has. */
function cycleEffort(composer: HTMLElement): void {
  composer.querySelector('[data-composer-label]')?.closest('button')?.click()
  requestAnimationFrame(() => {
    const levels = [
      ...document.querySelectorAll<HTMLElement>('[data-option-id="effort"] [role="radio"]')
    ].filter((level) => !level.hasAttribute('disabled'))
    const current = levels.findIndex((level) => level.getAttribute('aria-checked') === 'true')
    levels[(current + 1) % levels.length]?.click()
  })
}

/** ⌘⌥↵ forks the chat on screen to a new tab; ⌘⌥C copies its concise transcript. */
function handleRevioChatTabKey(event: KeyboardEvent): boolean {
  if (!event.metaKey || !event.altKey || event.ctrlKey || event.shiftKey) {
    return false
  }
  if (event.code !== 'Enter' && event.code !== 'KeyC') {
    return false
  }
  // The editor and file tree own ⌘⌥C (Copy Context, Copy file path) while focused.
  const focus = document.activeElement
  if (focus instanceof HTMLElement && focus.closest('.monaco-editor, [role="tree"]')) {
    return false
  }
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  const groupId = worktreeId
    ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
    : null
  const tabId = worktreeId
    ? state.groupsByWorktree[worktreeId]?.find((group) => group.id === groupId)?.activeTabId
    : null
  const actions = tabId ? nativeChatTabActions(tabId) : null
  if (!tabId || !actions) {
    return false
  }
  if (event.code === 'KeyC') {
    return copyRevioChatTranscript(tabId, 'concise')
  }
  if (actions.canFork()) {
    actions.forkLatest()
  }
  return true
}

type ChatKey = { code: string; shift: boolean; run: (composer: HTMLElement) => void }

// The chat keys (its 0.92 keybinding registry). They act on the chat on screen and leave
// the key alone when there is none, so a browser tab keeps ⌘L for its address bar.
const CHAT_KEYS: readonly ChatKey[] = [
  { code: 'KeyL', shift: false, run: (composer) => composerInput(composer)?.focus() },
  {
    code: 'Backspace',
    shift: true,
    // The composer's own Escape stops the running turn.
    run: (composer) =>
      composerInput(composer)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      )
  },
  {
    code: 'Slash',
    shift: false,
    run: (composer) => composer.querySelector('[data-composer-label]')?.closest('button')?.click()
  },
  { code: 'Slash', shift: true, run: cycleEffort },
  {
    // ⌘; "Insert snippet".
    code: 'Semicolon',
    shift: false,
    run: (composer) => {
      const input = composerInput(composer)
      if (input) {
        requestSnippetInsert(input)
      }
    }
  },
  {
    code: 'KeyU',
    shift: false,
    run: (composer) => composer.querySelector<HTMLElement>('[data-native-chat-attach]')?.click()
  }
]

/** The chat, review and diff keys while a workspace is on screen. */
export function useRevioChatKeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const enterInto = event.key === 'Enter' ? shownComposer() : null
      const enterInput = enterInto ? composerInput(enterInto) : null
      if (
        enterInto &&
        enterInput?.contains(document.activeElement) &&
        runUltracodeCommand(event, enterInto, enterInput)
      ) {
        event.stopPropagation()
        return
      }
      const hashInto = event.key === '#' ? shownComposer() : null
      const hashInput = hashInto ? composerInput(hashInto) : null
      if (hashInput?.contains(document.activeElement) && typedHashStartsWord(event, hashInput)) {
        // `#` PR or issue context: the `#` is typed, then the picker opens.
        window.setTimeout(() =>
          window.dispatchEvent(new CustomEvent(REVIO_HASH_CONTEXT_EVENT, { detail: hashInput }))
        )
        return
      }
      const typedInto = event.key === ' ' || event.key === 'Tab' ? shownComposer() : null
      const typedInput = typedInto ? composerInput(typedInto) : null
      if (
        typedInput?.contains(document.activeElement) &&
        expandSnippetKeyword(
          event,
          typedInput,
          useAppStore.getState().settings?.revioPromptSnippets ?? []
        )
      ) {
        event.stopPropagation()
        return
      }
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === 'KeyO') {
        // ⌃O ("Garry mode"): expand or collapse every tool call. Shells keep ⌃O.
        const focus = document.activeElement
        if (!(focus instanceof HTMLElement && focus.closest('.xterm, .monaco-editor'))) {
          event.preventDefault()
          const state = useAppStore.getState()
          void state.updateSettings({
            revioExpandToolCalls: state.settings?.revioExpandToolCalls !== true
          })
          return
        }
      }
      const shown = shownComposer()
      const slot = revioLoadoutSlot(event)
      const loadout = slot ? useAppStore.getState().settings?.revioLoadouts?.[slot - 1] : null
      if (loadout) {
        // ⌘⌃1…5 "Select loadout".
        event.preventDefault()
        event.stopPropagation()
        void applyRevioLoadout(loadout, shown)
        return
      }
      if (
        handleRevioDiffKey(event) ||
        handleRevioCommentKey(event) ||
        (shown && handleRevioChatModeKey(event, shown))
      ) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (handleRevioChatTabKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (!event.metaKey || event.altKey || event.ctrlKey) {
        return
      }
      const state = useAppStore.getState()
      if (state.activeView === 'settings' || state.activeTabType === 'browser') {
        return
      }
      if (event.shiftKey && event.code === 'KeyR' && state.activeWorktreeId) {
        // ⌘⇧R: "Start review", the Review button's agent chat.
        event.preventDefault()
        void requestRevioReview(state.activeWorktreeId)
        return
      }
      if (!event.shiftKey && event.code === 'KeyE' && state.activeTabType === 'editor') {
        // ⌘E "Toggle file edit mode" on the diff on screen.
        event.preventDefault()
        setRevioDiffEditMode(!revioDiffEditMode())
        return
      }
      if (!event.shiftKey && event.code === 'KeyO' && state.activeWorktreeId) {
        // ⌘O: the workspace in the first Open In app (a local workspace only).
        const worktree = findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
        const repo = worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : null
        const app = state.settings?.openInApplications?.[0]
        if (worktree && repo && !repo.connectionId && repo.executionHostId === 'local' && app) {
          event.preventDefault()
          void openWorktreePath({
            target: 'external-editor',
            worktreePath: worktree.path,
            openInApplicationId: app.id,
            command: app.command
          })
        }
        return
      }
      if (!event.shiftKey && event.code === 'KeyI' && state.activeWorktreeId && shown) {
        // ⌘I "Link issue" from the chat: the workspace's issue link.
        const worktree = findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
        if (worktree) {
          event.preventDefault()
          state.openModal('edit-meta', {
            worktreeId: worktree.id,
            repoId: worktree.repoId,
            executionHostId: worktree.hostId,
            currentDisplayName: worktree.displayName,
            currentIssue: worktree.linkedIssue,
            currentPR: worktree.linkedPR,
            currentComment: worktree.comment,
            focus: 'issue',
            // ⌘I links a Linear issue; with Linear connected the field starts there.
            ...(state.linearStatus.connected ? { linkKind: 'linear-issue' } : {})
          })
        }
        return
      }
      if (event.shiftKey && event.code === 'KeyO' && state.activeWorktreeId) {
        // ⌘⇧O: the workspace's "Open in" menu in the top bar.
        event.preventDefault()
        window.dispatchEvent(new Event(REVIO_OPEN_IN_MENU_EVENT))
        return
      }
      if (event.shiftKey && event.code === 'KeyC' && state.activeWorktreeId) {
        // ⌘⇧C: copy a link to the workspace on screen.
        event.preventDefault()
        copyRevioLink({ worktreeId: state.activeWorktreeId })
        return
      }
      if (event.shiftKey && event.code === 'KeyD' && state.activeWorktreeId) {
        // ⌘⇧D "Open diff view": every changed file in one diff.
        const worktree = findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
        if (worktree) {
          event.preventDefault()
          state.openAllDiffs(worktree.id, worktree.path)
        }
        return
      }
      const input = shown ? composerInput(shown) : null
      if (event.shiftKey && event.code === 'KeyV' && input?.contains(document.activeElement)) {
        event.preventDefault()
        event.stopPropagation()
        void pasteCopiedFilePaths(input)
        return
      }
      const key = CHAT_KEYS.find(
        (candidate) => candidate.code === event.code && candidate.shift === event.shiftKey
      )
      const composer = key ? shownComposer() : null
      if (key && composer) {
        event.preventDefault()
        event.stopPropagation()
        key.run(composer)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}

export function RevioChatKeys(): React.JSX.Element {
  useRevioChatKeys()
  return createElement(
    Fragment,
    null,
    createElement(RevioSnippetDialog),
    createElement(RevioHashContextDialog)
  )
}
