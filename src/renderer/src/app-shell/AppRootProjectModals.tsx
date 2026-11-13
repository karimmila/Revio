import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { WslMoveDialogHost } from '../components/wsl-move/WslMoveDialog'
import type { AppState } from '../store/types'
import { ModalBoundary } from './app-root-surface-boundaries'

const AddRepoDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/AddRepoDialog')
)
const NonGitFolderDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/NonGitFolderDialog')
)
const AddProjectFromFolderDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/AddProjectFromFolderDialog')
)
const DiagramViewerModal = lazy(() => import('../components/editor/DiagramViewerModal'))
const ProjectAddedDialog = lazy(
  () => import('../components/sidebar/project-admission/completion/ProjectAddedDialog')
)
const NodeDistMirrorDialog = lazy(
  () => import('../components/settings/advanced/network/NodeDistMirrorDialog')
)
const AiVaultSessionHistoryDialog = lazy(
  () => import('../components/right-sidebar/ai-vault/session-list/AiVaultSessionHistoryDialog')
)
const NativeChatMcpStatusDialog = lazy(
  () => import('../components/native-chat/NativeChatMcpStatusDialog')
)
const NativeChatLinkDirectoriesDialog = lazy(
  () => import('../components/native-chat/NativeChatLinkDirectoriesDialog')
)
const NativeChatAccountUsageDialog = lazy(
  () => import('../components/native-chat/NativeChatAccountUsageDialog')
)

/** Project admission and chat dialogs that the root hosts so they outlive the surface that opened them. */
export function AppRootProjectModals({
  activeModal,
  shouldMountAddRepoDialog
}: {
  activeModal: AppState['activeModal']
  shouldMountAddRepoDialog: boolean
}): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      {shouldMountAddRepoDialog ? (
        <ModalBoundary boundaryId="modal.add-repo" resetKey={activeModal === 'add-repo'}>
          <AddRepoDialog />
        </ModalBoundary>
      ) : null}
      {/* Settings can add projects without Sidebar; host its handoff dialogs here too. */}
      {activeModal === 'confirm-non-git-folder' ? (
        <ModalBoundary boundaryId="modal.confirm-non-git-folder" resetKey>
          <NonGitFolderDialog />
        </ModalBoundary>
      ) : null}
      {activeModal === 'confirm-add-project-from-folder' ? (
        <ModalBoundary boundaryId="modal.confirm-add-project-from-folder" resetKey>
          <AddProjectFromFolderDialog />
        </ModalBoundary>
      ) : null}
      {activeModal === 'project-added' ? (
        <ModalBoundary boundaryId="modal.project-added" resetKey>
          <ProjectAddedDialog />
        </ModalBoundary>
      ) : null}
      {/* Root hosting prevents chat capture handlers receiving /resume and /usage dialog events. */}
      {activeModal === 'agent-session-history' ? (
        <ModalBoundary boundaryId="modal.agent-session-history" resetKey>
          <AiVaultSessionHistoryDialog />
        </ModalBoundary>
      ) : null}
      {activeModal === 'chat-mcp-status' ? (
        <ModalBoundary boundaryId="modal.chat-mcp-status" resetKey>
          <NativeChatMcpStatusDialog />
        </ModalBoundary>
      ) : null}
      {activeModal === 'chat-link-directories' ? (
        <ModalBoundary boundaryId="modal.chat-link-directories" resetKey>
          <NativeChatLinkDirectoriesDialog />
        </ModalBoundary>
      ) : null}
      {activeModal === 'chat-account-usage' ? (
        <ModalBoundary boundaryId="modal.chat-account-usage" resetKey>
          <NativeChatAccountUsageDialog />
        </ModalBoundary>
      ) : null}
      {/* Own store, not activeModal: another modal must never evict a running move. */}
      <WslMoveDialogHost />
      {/* Opened by toast, SSH host row and terminal pane. */}
      {activeModal === 'node-dist-mirror' ? (
        <ModalBoundary boundaryId="modal.node-dist-mirror" resetKey>
          <NodeDistMirrorDialog />
        </ModalBoundary>
      ) : null}
      {/* The viewer must outlive the virtualized chat row that opened it. */}
      {activeModal === 'diagram-viewer' ? (
        <ModalBoundary boundaryId="modal.diagram-viewer" resetKey>
          <DiagramViewerModal />
        </ModalBoundary>
      ) : null}
    </Suspense>
  )
}
