import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import { usePluginCommands } from '@/store/plugin-panels'
import { usePluginNewFiles } from '@/store/plugin-new-files'
import { useSettingsNavigationMetadata } from '@/hooks/useSettingsNavigationMetadata'
import { dedupePaletteWorktrees } from '@/lib/workspace/search/palette-repo-resolution'
import {
  selectPaletteIndexStatusSnapshot,
  selectPaletteStatusInputs
} from './worktree-jump-palette-status-inputs'
import { selectWorktreePaletteCacheInputs } from '@/components/cmd-j/worktree-palette-cache-inputs'
import {
  resolveQualifiedIndexedFolderWorkspace,
  selectDetectedWorktreesByRepo,
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspace-record-selectors'
import { getFolderWorkspaceWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import {
  revioUnlistedCheckoutIds,
  withoutRevioRootCheckoutKeys,
  withoutRevioRootCheckouts
} from '../../../../shared/revio-root-checkout'

export function useWorktreeJumpPaletteStoreState({
  visible,
  lingering
}: {
  visible: boolean
  lingering: boolean
}) {
  useTranslation()
  // Freeze age labels for one palette session; live status dots own their clock separately.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- visibility intentionally starts a new session clock.
  const paletteNowMs = useMemo(() => Date.now(), [visible])
  const closeModal = useAppStore((state) => state.closeModal)
  const openModal = useAppStore((state) => state.openModal)
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const recordFeatureInteraction = useAppStore((state) => state.recordFeatureInteraction)
  const revealSidebarRow = useAppStore((state) => state.revealSidebarRow)
  const listedWorktreesByRepo = useAppStore((state) => selectWorktreesByRepo(state))
  const folderWorkspaces = useAppStore((state) => selectFolderWorkspaces(state))
  const repos = useAppStore((state) => state.repos)
  const revioLayout = useAppStore((state) => state.settings?.revioLayout === true)
  // The workspace layout never opens a repository's own checkout, so the palette lists neither
  // it nor the tabs an earlier build left on it; nor a folder project's own "primary" row.
  const rootCheckoutIds = useMemo(
    () => revioUnlistedCheckoutIds({ revioLayout }, repos, listedWorktreesByRepo),
    [listedWorktreesByRepo, repos, revioLayout]
  )
  const worktreesByRepo = useMemo(
    () => withoutRevioRootCheckouts(listedWorktreesByRepo, rootCheckoutIds),
    [listedWorktreesByRepo, rootCheckoutIds]
  )
  const projectGroups = useAppStore((state) => state.projectGroups)
  const workspaces = useMemo(
    () =>
      dedupePaletteWorktrees([
        ...Object.values(worktreesByRepo).flat(),
        ...folderWorkspaces.map((folder) => {
          const result = resolveQualifiedIndexedFolderWorkspace(
            { folderWorkspaces, repos, projectGroups },
            folder.id
          )
          return getFolderWorkspaceWorktree(
            folder,
            result.kind === 'selected' && result.value.workspace === folder
              ? result.value
              : undefined
          )
        })
      ]),
    [folderWorkspaces, projectGroups, repos, worktreesByRepo]
  )
  const projects = useAppStore((state) => state.projects)
  const projectHostSetups = useAppStore((state) => state.projectHostSetups)
  const detectedWorktreesByRepo = useAppStore((state) => selectDetectedWorktreesByRepo(state))
  const pendingWorktreeCreations = useAppStore((state) => state.pendingWorktreeCreations)
  const pluginCommands = usePluginCommands()
  const pluginNewFiles = usePluginNewFiles()
  const paletteStatusInputsActive = visible || lingering
  const {
    ptyIdsByTabId,
    terminalLayoutsByTabId,
    tabsByWorktree: allTabsByWorktree
  } = useAppStore(
    useShallow((state) => selectPaletteStatusInputs(state, paletteStatusInputsActive))
  )
  const tabsByWorktree = useMemo(
    () => withoutRevioRootCheckoutKeys(allTabsByWorktree, rootCheckoutIds),
    [allTabsByWorktree, rootCheckoutIds]
  )
  const { prCache, issueCache, hostedReviewCache } = useAppStore(
    useShallow((state) => selectWorktreePaletteCacheInputs(state, paletteStatusInputsActive))
  )
  const migrationUnsupportedByPtyId = useAppStore((state) => state.migrationUnsupportedByPtyId)
  const activeView = useAppStore((state) => state.activeView)
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const activeWorkspaceExecutionHostId = useAppStore(
    (state) => state.activeWorkspaceExecutionHostId
  )
  const activeTabType = useAppStore((state) => state.activeTabType)
  const activeTabId = useAppStore((state) => state.activeTabId)
  const activeTabIdByWorktree = useAppStore((state) => state.activeTabIdByWorktree)
  const activeFileId = useAppStore((state) => state.activeFileId)
  const activeFileIdByWorktree = useAppStore((state) => state.activeFileIdByWorktree)
  const activeTabTypeByWorktree = useAppStore((state) => state.activeTabTypeByWorktree)
  const activeBrowserTabId = useAppStore((state) => state.activeBrowserTabId)
  const allBrowserTabsByWorktree = useAppStore((state) => state.browserTabsByWorktree)
  const browserTabsByWorktree = useMemo(
    () => withoutRevioRootCheckoutKeys(allBrowserTabsByWorktree, rootCheckoutIds),
    [allBrowserTabsByWorktree, rootCheckoutIds]
  )
  const browserPagesByWorkspace = useAppStore((state) => state.browserPagesByWorkspace)
  const allUnifiedTabsByWorktree = useAppStore((state) => state.unifiedTabsByWorktree)
  const unifiedTabsByWorktree = useMemo(
    () => withoutRevioRootCheckoutKeys(allUnifiedTabsByWorktree, rootCheckoutIds),
    [allUnifiedTabsByWorktree, rootCheckoutIds]
  )
  const structuredChatSleptAtByPaneKey = useAppStore(
    (state) => state.structuredChatSleptAtByPaneKey
  )
  const paletteIndexStatus = useMemo(
    () => selectPaletteIndexStatusSnapshot(useAppStore.getState(), paletteStatusInputsActive),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- these deps are the snapshot refresh policy.
    [paletteStatusInputsActive, tabsByWorktree, unifiedTabsByWorktree]
  )
  const {
    agentStatusByPaneKey,
    runtimePaneTitlesByTabId,
    unreadTerminalTabs,
    unreadAgentCompletionPanes
  } = paletteIndexStatus
  const allOpenFiles = useAppStore((state) => state.openFiles)
  const openFiles = useMemo(
    () =>
      rootCheckoutIds.size === 0
        ? allOpenFiles
        : allOpenFiles.filter((file) => !rootCheckoutIds.has(file.worktreeId)),
    [allOpenFiles, rootCheckoutIds]
  )
  const activeGroupIdByWorktree = useAppStore((state) => state.activeGroupIdByWorktree)
  const groupsByWorktree = useAppStore((state) => state.groupsByWorktree)
  const retainedAgentsByPaneKey = useAppStore((state) => state.retainedAgentsByPaneKey)
  const sleepingAgentSessionsByPaneKey = useAppStore(
    (state) => state.sleepingAgentSessionsByPaneKey
  )
  const paneForegroundAgentByPaneKey = useAppStore((state) => state.paneForegroundAgentByPaneKey)
  const settings = useAppStore((state) => state.settings)
  const worktreeVisibilityDefaultsByHost = useAppStore(
    (state) => state.worktreeVisibilityDefaultsByHost
  )
  const sshTargetLabels = useAppStore((state) => state.sshTargetLabels)
  const sshConnectionStates = useAppStore((state) => state.sshConnectionStates)
  const runtimeEnvironments = useAppStore((state) => state.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((state) => state.runtimeStatusByEnvironmentId)
  const hideDefaultBranchWorkspace = useAppStore((state) => state.hideDefaultBranchWorkspace)
  const hideAutomationGeneratedWorkspaces = useAppStore(
    (state) => state.hideAutomationGeneratedWorkspaces
  )
  const hideCliCreatedWorkspaces = useAppStore((state) => state.hideCliCreatedWorkspaces)
  const hideDetachedHeadWorkspaces = useAppStore((state) => state.hideDetachedHeadWorkspaces)
  const hideWorkspacesFromOtherDevices = useAppStore(
    (state) => state.hideWorkspacesFromOtherDevices
  )
  const showSleepingWorkspaces = useAppStore((state) => state.showSleepingWorkspaces)
  const alwaysShowDefaultBranchWorkspace = useAppStore(
    (state) => state.alwaysShowDefaultBranchWorkspace
  )
  const lastVisitedAtByWorktreeId = useAppStore((state) => state.lastVisitedAtByWorktreeId)
  const workspacePortScan = useAppStore((state) => state.workspacePortScan?.result ?? null)
  const openNewBrowserTabInActiveWorkspace = useAppStore(
    (state) => state.openNewBrowserTabInActiveWorkspace
  )
  const openNewMarkdownInActiveWorkspace = useAppStore(
    (state) => state.openNewMarkdownInActiveWorkspace
  )
  const openNewTerminalTabInActiveWorkspace = useAppStore(
    (state) => state.openNewTerminalTabInActiveWorkspace
  )
  const settingsSections = useSettingsNavigationMetadata()

  return {
    visible,
    paletteNowMs,
    closeModal,
    openModal,
    openSettingsPage,
    openSettingsTarget,
    recordFeatureInteraction,
    revealSidebarRow,
    worktreesByRepo,
    workspaces,
    repos,
    projectGroups,
    projects,
    projectHostSetups,
    detectedWorktreesByRepo,
    pendingWorktreeCreations,
    pluginCommands,
    pluginNewFiles,
    paletteStatusInputsActive,
    ptyIdsByTabId,
    terminalLayoutsByTabId,
    tabsByWorktree,
    prCache,
    issueCache,
    hostedReviewCache,
    migrationUnsupportedByPtyId,
    activeView,
    activeWorktreeId,
    activeWorkspaceExecutionHostId,
    activeTabType,
    activeTabId,
    activeTabIdByWorktree,
    activeFileId,
    activeFileIdByWorktree,
    activeTabTypeByWorktree,
    activeBrowserTabId,
    browserTabsByWorktree,
    browserPagesByWorkspace,
    unifiedTabsByWorktree,
    structuredChatSleptAtByPaneKey,
    agentStatusByPaneKey,
    runtimePaneTitlesByTabId,
    unreadTerminalTabs,
    unreadAgentCompletionPanes,
    openFiles,
    activeGroupIdByWorktree,
    groupsByWorktree,
    retainedAgentsByPaneKey,
    sleepingAgentSessionsByPaneKey,
    paneForegroundAgentByPaneKey,
    settings,
    worktreeVisibilityDefaultsByHost,
    sshTargetLabels,
    sshConnectionStates,
    runtimeEnvironments,
    runtimeStatusByEnvironmentId,
    hideDefaultBranchWorkspace,
    hideAutomationGeneratedWorkspaces,
    hideCliCreatedWorkspaces,
    hideDetachedHeadWorkspaces,
    hideWorkspacesFromOtherDevices,
    showSleepingWorkspaces,
    alwaysShowDefaultBranchWorkspace,
    lastVisitedAtByWorktreeId,
    workspacePortScan,
    openNewBrowserTabInActiveWorkspace,
    openNewMarkdownInActiveWorkspace,
    openNewTerminalTabInActiveWorkspace,
    settingsSections,
    statusInputsLingering: lingering
  }
}

export type WorktreeJumpPaletteStoreState = ReturnType<typeof useWorktreeJumpPaletteStoreState>
