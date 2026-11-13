import TabBar from '@/components/tab-bar/TabBar'
import { TabGroupSplitNodeTree } from '@/components/tab-group/TabGroupSplitNodeTree'
import { WorkspaceTabDragLayer } from '@/components/tab-group/WorkspaceTabDragLayer'
import { RevioDockPaneLayers } from '@/components/revio-layout/RevioDockPaneLayers'
import { isTerminalImeInputContextRefreshing } from '@/components/terminal-pane/input/ime/terminal-ime-input-context-refresh'
import { buildDuplicatedBrowserTabOptions } from '@/lib/duplicate-browser-tab-options'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { FloatingTerminalEmptyState } from './FloatingTerminalEmptyState'
import { renderFloatingTerminalOrchestrationCard } from './FloatingTerminalOrchestrationCard'
import { FloatingTerminalOrchestrationDialog } from './FloatingTerminalOrchestrationDialog'
import { FloatingTerminalResizeHandles } from './FloatingTerminalResizeHandles'
import { FloatingTerminalWindowControls } from './FloatingTerminalWindowControls'
import { ChevronDown } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { useFloatingTerminalPanelController } from './use-floating-terminal-panel-controller'

const NO_ACTIVITY_TERMINAL_PORTALS: [] = []

export function renderFloatingTerminalPanelSurface({
  open,
  onOpenChange,
  bounds,
  maximized,
  stagedBoundsRef,
  setPanelNode,
  commitUserBounds,
  reportFloatingFocusFromTarget,
  handleShortcutSurfaceKeyDown,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleTitlebarDoubleClick,
  surface,
  model,
  terminalItems,
  activeGroup,
  activeTerminalId,
  activeEditorUnifiedId,
  activeBrowserId,
  activeTab,
  activeTabType,
  expandedPaneByTabId,
  closeFloatingItemConfirmed,
  closeOthers,
  closeToRight,
  closeToLeft,
  createFloatingTerminalTab,
  createFloatingBrowserTab,
  createFloatingMarkdownTab,
  openFloatingMarkdownTab,
  setTabCustomTitle,
  setTabColor,
  setTabPaneExpanded,
  createBrowserTab,
  closeAllFiles,
  makePreviewFilePermanent,
  pinFile,
  toggleMaximized,
  hasVisibleFloatingTabs,
  managedBrowserCreationEnabled,
  cwd,
  panelViewportSettled,
  focusPanelForShortcuts,
  newTerminalShortcut,
  newBrowserShortcut,
  newMarkdownShortcut,
  openMarkdownShortcut,
  closeShortcut,
  showOrchestrationSetup,
  dismissOrchestrationSetup,
  setOrchestrationDialogOpen,
  previewUserBounds,
  orchestrationDialogOpen,
  refreshOrchestrationSetupVisibility,
  docked = false
}: ReturnType<typeof useFloatingTerminalPanelController> & {
  /** Workspace layout: flat, fixed into the right column's dock, folded by its chevron. */
  docked?: boolean
}): React.JSX.Element {
  return (
    // Stay above notifications but below modals; separate shadow and border shells to keep rounded corners clean.
    <div
      ref={setPanelNode}
      data-floating-terminal-panel
      aria-hidden={!open}
      tabIndex={-1}
      className={`fixed flex text-card-foreground outline-none ${docked ? 'z-[40] bg-card' : 'z-[45] min-h-[280px] min-w-[420px] rounded-lg bg-transparent shadow-[0_4px_12px_rgba(0,0,0,0.16),0_24px_64px_rgba(0,0,0,0.32)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.35),0_28px_72px_rgba(0,0,0,0.58)]'} ${open ? 'opacity-100' : 'invisible pointer-events-none opacity-0'}`}
      style={{
        visibility: open ? 'visible' : 'hidden',
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      }}
      onMouseUp={(event) => {
        if (maximized || !stagedBoundsRef.current) {
          return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        commitUserBounds({
          ...stagedBoundsRef.current,
          width: rect.width,
          height: rect.height
        })
      }}
      onFocusCapture={(event) => reportFloatingFocusFromTarget(event.target)}
      onBlurCapture={(event) => {
        // Preserve shortcut ownership across macOS IME’s synchronous blur until refocus/skip settles it.
        if (!isTerminalImeInputContextRefreshing(event.target)) {
          reportFloatingFocusFromTarget(event.relatedTarget)
        }
      }}
      onKeyDownCapture={handleShortcutSurfaceKeyDown}
    >
      {/* Share one drag context between the strip and body so tabs can reorder or split. */}
      <WorkspaceTabDragLayer worktreeId={FLOATING_TERMINAL_WORKTREE_ID} enabled={open}>
        {({ isTabDragActive, hoveredTabInsertion, setDragRootNode }) => (
          <div
            ref={setDragRootNode}
            className={
              docked
                ? 'relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-card'
                : 'relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-lg border border-black/14 bg-card dark:border-white/14'
            }
          >
            <div
              className="flex h-9 shrink-0 cursor-grab items-center border-b border-border bg-[var(--bg-titlebar,var(--tab-bar,var(--card)))] active:cursor-grabbing"
              data-floating-terminal-shortcut-surface
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              onDoubleClick={handleTitlebarDoubleClick}
            >
              {/* The workspace layout puts the panel's collapse chevron first, before its tabs. */}
              {docked ? (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label={translate(
                    'auto.components.revioLayout.hideTerminal',
                    'Hide terminal'
                  )}
                  className="ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              ) : null}
              <div className="flex h-full min-w-0 flex-1">
                <TabBar
                  tabs={terminalItems}
                  activeTabId={
                    activeTab?.contentType === 'agent-session' ? activeTab.id : activeTerminalId
                  }
                  groupId={activeGroup?.id}
                  worktreeId={FLOATING_TERMINAL_WORKTREE_ID}
                  expandedPaneByTabId={expandedPaneByTabId}
                  onActivate={model.commands.activateTerminal}
                  onClose={closeFloatingItemConfirmed}
                  onCloseOthers={closeOthers}
                  onCloseToRight={closeToRight}
                  onCloseToLeft={closeToLeft}
                  onNewTerminalTab={() => createFloatingTerminalTab()}
                  onNewTerminalWithShell={createFloatingTerminalTab}
                  onNewBrowserTab={createFloatingBrowserTab}
                  onNewFileTab={createFloatingMarkdownTab}
                  onOpenFileTab={openFloatingMarkdownTab}
                  newTabMenuOrder="markdown-first"
                  onSetCustomTitle={setTabCustomTitle}
                  onSetTabColor={setTabColor}
                  onTogglePaneExpand={(tabId) =>
                    setTabPaneExpanded(tabId, expandedPaneByTabId[tabId] !== true)
                  }
                  editorFiles={model.editorItems}
                  browserTabs={model.browserItems}
                  agentSessionTabs={model.agentSessionItems}
                  groupActiveTabId={activeTab?.id ?? null}
                  activeFileId={activeEditorUnifiedId}
                  activeBrowserTabId={activeBrowserId}
                  activeSimulatorTabId={
                    activeTab?.contentType === 'simulator' ? activeTab.id : null
                  }
                  activeTabType={activeTabType}
                  onActivateFile={model.commands.activateEditor}
                  onCloseFile={closeFloatingItemConfirmed}
                  onActivateBrowserTab={model.commands.activateBrowser}
                  onActivateAgentSession={model.commands.activateAgentSession}
                  onCloseBrowserTab={closeFloatingItemConfirmed}
                  onDuplicateBrowserTab={(browserTabId, sourceUnifiedTabId) => {
                    const source = model.browserItems.find((tab) => tab.id === browserTabId)
                    if (!source) {
                      return
                    }
                    createBrowserTab(FLOATING_TERMINAL_WORKTREE_ID, source.url, {
                      ...buildDuplicatedBrowserTabOptions(source),
                      afterTabId: sourceUnifiedTabId,
                      browserRuntimeEnvironmentId: null
                    })
                  }}
                  onCloseAllFiles={closeAllFiles}
                  onMakePreviewFilePermanent={makePreviewFilePermanent}
                  onPinFile={pinFile}
                  tabBarOrder={model.tabBarOrder}
                  hoveredTabInsertion={hoveredTabInsertion}
                  tabStripChrome="floating-panel"
                />
              </div>
              {/* Keep a grab area even when the tab strip overflows. */}
              <div
                className="h-full w-16 shrink-0 select-none"
                data-floating-terminal-drag-handle
                aria-hidden
              />
              {docked ? null : (
                <FloatingTerminalWindowControls
                  maximized={maximized}
                  onToggleMaximized={toggleMaximized}
                  onMinimize={() => onOpenChange(false)}
                />
              )}
            </div>

            <div
              className="relative min-h-0 flex-1 overflow-hidden bg-background"
              data-contextual-tour-target={
                hasVisibleFloatingTabs ? 'floating-workspace-surface' : undefined
              }
            >
              {/* Unresolvable stale tabs need the empty-state actions instead of a blank body. */}
              {surface.kind === 'workspace' && hasVisibleFloatingTabs ? (
                // The tree needs a flex host owning its rect; block layout collapses panes to zero height.
                <div className="absolute inset-0 flex" data-floating-workspace-surface-frame>
                  <TabGroupSplitNodeTree
                    layout={surface.layout}
                    worktreeId={FLOATING_TERMINAL_WORKTREE_ID}
                    focusedGroupId={surface.focusedGroupId}
                    isWorktreeActive={open}
                    isTabDragActive={isTabDragActive}
                    hoveredTabInsertion={hoveredTabInsertion}
                    // Why external: the titlebar strip above is the panel's one tab row.
                    tabStrip="external"
                    // Floating scratch Markdown is local context rather than a repository review surface.
                    markdownAnnotationsEnabled={false}
                    rootTouchesBottomEdge={true}
                  />
                  {/* Wait for viewport settling before fitting terminals; a post-maximize fit can damage live TUI scrollback. */}
                  <RevioDockPaneLayers
                    worktreeId={FLOATING_TERMINAL_WORKTREE_ID}
                    worktreePath={cwd && panelViewportSettled ? cwd : ''}
                    isVisible={open}
                    shouldMeasureHiddenWorktree={false}
                    shouldColdParkTerminalPanes={false}
                    isForceParked={false}
                    activityTerminalPortals={NO_ACTIVITY_TERMINAL_PORTALS}
                    activationDeferredMountTabIds={null}
                    mountRetainedBrowserOverlay={true}
                    mountEmulatorOverlay={true}
                    // Why: the active workspace's listener owns the chord while the panel overlays it.
                    ownsNativeChatToggleShortcut={false}
                  />
                </div>
              ) : (
                <FloatingTerminalEmptyState
                  onNewTerminal={() => createFloatingTerminalTab()}
                  onNewMarkdown={createFloatingMarkdownTab}
                  onOpenMarkdown={openFloatingMarkdownTab}
                  onNewBrowser={createFloatingBrowserTab}
                  showNewBrowser={managedBrowserCreationEnabled}
                  onClose={() => onOpenChange(false)}
                  onFocusPanel={focusPanelForShortcuts}
                  newTerminalShortcut={newTerminalShortcut}
                  newBrowserShortcut={newBrowserShortcut}
                  newMarkdownShortcut={newMarkdownShortcut}
                  openMarkdownShortcut={openMarkdownShortcut}
                  closeShortcut={closeShortcut}
                />
              )}
            </div>
          </div>
        )}
      </WorkspaceTabDragLayer>
      {renderFloatingTerminalOrchestrationCard({
        visible: showOrchestrationSetup && activeTabType === 'terminal',
        onDismiss: dismissOrchestrationSetup,
        onEnable: () => setOrchestrationDialogOpen(true)
      })}
      {!maximized && (
        <FloatingTerminalResizeHandles
          bounds={bounds}
          onPreviewBounds={previewUserBounds}
          onCommitBounds={commitUserBounds}
        />
      )}
      <FloatingTerminalOrchestrationDialog
        open={orchestrationDialogOpen}
        onOpenChange={setOrchestrationDialogOpen}
        onSetupStateChange={() => void refreshOrchestrationSetupVisibility()}
      />
    </div>
  )
}
