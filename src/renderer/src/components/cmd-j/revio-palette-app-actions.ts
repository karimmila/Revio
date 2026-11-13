import {
  FolderInput,
  FolderPlus,
  Keyboard,
  Link,
  Link2,
  ScrollText,
  Maximize2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Settings,
  SunMoon,
  TextQuote
} from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { REVIO_SHORTCUTS_OVERLAY_EVENT } from '@/components/revio-layout/RevioShortcutsOverlay'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import type { CmdJQuickAction } from './quick-actions'
import { copyRevioLink } from '@/components/revio-layout/RevioLinkRouter'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { requestSnippetInsert } from '@/components/revio-layout/snippets/revio-snippet-insert'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { action } from './revio-palette-action'
import { openRevioSectionDialog } from '@/components/revio-layout/RevioSectionDialog'
import { moveWorkspaceToSection } from '@/components/revio-layout/revio-sidebar-sections'
import { isAppUpdaterEnabled } from '../../../../shared/update-feed'
import { forkServiceEndpoint } from '../../../../shared/fork-services'
import { appFeedbackEntry, openAppFeedback } from '@/lib/app-feedback-entry'
import { releaseNoticeRepo } from '../../../../shared/release-notice'

type Say = (key: string, fallback: string) => string

/** "Send feedback" when this build has its own endpoint, "Report an issue" for a tracker, else none. */
function feedbackActions(say: Say): CmdJQuickAction[] {
  const entry = appFeedbackEntry()
  if (!entry) {
    return []
  }
  if (entry.kind === 'issues') {
    return [
      action(
        'feedback',
        say('auto.components.cmd.j.revio.reportIssue', 'Report an issue'),
        MessageSquareText,
        ['bug', 'report', 'feedback', 'issue'],
        () => void openAppFeedback(() => undefined),
        false
      )
    ]
  }
  return [
    action(
      'feedback',
      say('auto.components.cmd.j.revio.feedback', 'Send feedback'),
      MessageSquareText,
      ['bug', 'report'],
      () => pressAppKey('KeyF', { alt: true }),
      false
    )
  ]
}

/** Presses one of the app keys (RevioAppKeys), so palette and key stay one action. */
function pressAppKey(code: string, mods: { alt?: boolean; shift?: boolean }): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      metaKey: true,
      altKey: mods.alt === true,
      shiftKey: mods.shift === true,
      bubbles: true,
      cancelable: true
    })
  )
}

/** The chat input on screen; hidden tabs keep theirs mounted at zero size. */
function shownChatInput(): HTMLElement | null {
  for (const scope of document.querySelectorAll('[data-native-chat-composer-scope]')) {
    if (scope instanceof HTMLElement && scope.getBoundingClientRect().width > 0) {
      return scope.querySelector<HTMLElement>('[contenteditable="true"]')
    }
  }
  return null
}

/** "Move to section": each existing section first, then "New section…". */
function moveToSectionActions(): CmdJQuickAction[] {
  const state = useAppStore.getState()
  const sections = state.settings?.revioSidebarSections ?? []
  const moveTo = (sectionId: string) => (): void => {
    const current = useAppStore.getState()
    if (current.activeWorktreeId) {
      void current.updateSettings({
        revioWorkspaceSections: moveWorkspaceToSection(
          current.settings?.revioWorkspaceSections,
          current.activeWorktreeId,
          sectionId
        )
      })
    }
  }
  return [
    ...sections.map((section) =>
      action(
        `move-to-section:${section.id}`,
        translate('auto.components.cmd.j.revio.moveToNamedSection', 'Move to section: {{value0}}', {
          value0: section.name
        }),
        FolderInput,
        ['section', 'group', 'move', section.name],
        moveTo(section.id)
      )
    ),
    action(
      'move-to-section',
      translate('auto.components.cmd.j.revio.moveToNewSection', 'Move to section: New section…'),
      FolderInput,
      ['section', 'group', 'move', 'new'],
      () => {
        const worktreeId = useAppStore.getState().activeWorktreeId
        if (worktreeId) {
          openRevioSectionDialog({ moveWorktreeId: worktreeId })
        }
      }
    )
  ]
}

/** The palette's app-wide actions in the workspace layout (its "Actions" group). */
export function getRevioPaletteAppActions(): CmdJQuickAction[] {
  const say = translate
  const changelogUrl = forkServiceEndpoint('whatsNewUrl', 'changelog')
  return [
    action(
      'create-workspace',
      say('auto.components.cmd.j.revio.createWorkspace', 'Create workspace'),
      Plus,
      ['new', 'workspace'],
      openWorkspaceCreationComposerWithTourHandoff,
      false
    ),
    action(
      'add-project',
      say('auto.components.cmd.j.revio.addProject', 'Add project'),
      FolderPlus,
      ['repository', 'repo', 'clone'],
      () => useAppStore.getState().openModal('add-repo'),
      false
    ),
    action(
      'create-section',
      say('auto.components.cmd.j.revio.createSection', 'Create section'),
      FolderPlus,
      ['section', 'group', 'sidebar'],
      () => openRevioSectionDialog({}),
      false
    ),
    ...moveToSectionActions(),
    action(
      'toggle-theme',
      say('auto.components.cmd.j.revio.toggleTheme', 'Toggle theme'),
      SunMoon,
      ['dark', 'light', 'theme'],
      () => pressAppKey('KeyT', { alt: true }),
      false
    ),
    action(
      'toggle-zen',
      say('auto.components.cmd.j.revio.toggleZen', 'Toggle zen mode'),
      Maximize2,
      ['zen', 'focus', 'hide'],
      () => pressAppKey('Period', {}),
      false
    ),
    action(
      'settings',
      say('auto.components.cmd.j.revio.settings', 'Settings'),
      Settings,
      ['preferences'],
      () => useAppStore.getState().openSettingsPage(),
      false
    ),
    action(
      'shortcuts',
      say('auto.components.cmd.j.revio.shortcuts', 'Show keyboard shortcuts'),
      Keyboard,
      ['keys', 'keybindings', 'hotkeys'],
      () => window.dispatchEvent(new Event(REVIO_SHORTCUTS_OVERLAY_EVENT)),
      false
    ),
    ...feedbackActions(say),
    action(
      'copy-link',
      say('auto.components.cmd.j.revio.copyLink', 'Copy link to workspace'),
      Link,
      ['url', 'share', 'link'],
      () => {
        const worktreeId = useAppStore.getState().activeWorktreeId
        if (worktreeId) {
          copyRevioLink({ worktreeId })
        }
      }
    ),
    action(
      'link-issue',
      say('auto.components.cmd.j.revio.linkIssue', 'Link issue or PR'),
      Link2,
      ['linear', 'github', 'issue', 'pull request'],
      () => {
        const state = useAppStore.getState()
        const worktree = state.activeWorktreeId
          ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
          : undefined
        if (worktree) {
          state.openModal('edit-meta', {
            worktreeId: worktree.id,
            repoId: worktree.repoId,
            executionHostId: worktree.hostId,
            currentDisplayName: worktree.displayName,
            currentIssue: worktree.linkedIssue,
            currentPR: worktree.linkedPR,
            currentComment: worktree.comment,
            focus: 'issue'
          })
        }
      }
    ),
    action(
      'insert-snippet',
      say('auto.components.cmd.j.revio.insertSnippet', 'Insert snippet'),
      TextQuote,
      ['snippet', 'prompt', 'create snippet', 'edit snippets'],
      () => {
        const input = shownChatInput()
        if (input) {
          requestSnippetInsert(input)
        }
      }
    ),
    ...(changelogUrl
      ? [
          action(
            'changelog',
            say('auto.components.cmd.j.revio.changelog', 'Open changelog'),
            ScrollText,
            ['release', 'notes', 'whats new'],
            () => openAppHttpLink(changelogUrl),
            false
          )
        ]
      : []),
    ...(isAppUpdaterEnabled()
      ? [
          action(
            'check-updates',
            say('auto.components.cmd.j.revio.checkUpdates', 'Check for updates'),
            RefreshCw,
            ['update', 'version'],
            () => void window.api.updater.check(),
            false
          )
        ]
      : releaseNoticeRepo()
        ? [
            action(
              'check-updates',
              say('auto.components.cmd.j.revio.checkUpdates', 'Check for updates'),
              RefreshCw,
              ['update', 'version'],
              // No self-updater in this build: ask the releases page and say what it found.
              () => void window.api.releaseNotice?.check(),
              false
            )
          ]
        : [])
  ]
}
