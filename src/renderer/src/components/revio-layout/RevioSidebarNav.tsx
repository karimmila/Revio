import React from 'react'
import { Home, LayoutDashboard, Plus, Search } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { translate } from '@/i18n/i18n'
import { RevioLocationSwitcher } from './RevioLocationSwitcher'
import { TOGGLE_WORKSPACE_BOARD_EVENT } from '@/components/sidebar/workspace-board/surface/useWorkspaceBoardPanel'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import { selectWorktreeCreationSurfaceShown } from '@/lib/workspace/creation/worktree-creation-surface'
import { clearRevioAsleepView, useRevioAsleepViewId } from './revio-asleep-view'

type ShortcutCombo = ReturnType<typeof useShortcutKeyComboDetails>[number]

function NavRow({
  icon: Icon,
  label,
  combo,
  active = false,
  onClick
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  combo?: ShortcutCombo
  active?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-[29px] w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-foreground'
          : 'text-worktree-sidebar-foreground/80 hover:bg-worktree-sidebar-foreground/6 hover:text-worktree-sidebar-foreground'
      )}
    >
      <Icon className="size-3 shrink-0 text-worktree-sidebar-foreground/55" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {combo ? (
        <ShortcutKeyCombo
          keys={combo.keys}
          doubleTap={combo.doubleTap}
          className="pointer-events-none hidden gap-0.5 group-hover:inline-flex"
          keyCapClassName="min-w-4 border-transparent bg-transparent px-0.5 py-px text-[11px] text-worktree-sidebar-foreground/35 shadow-none"
          separatorClassName="hidden"
        />
      ) : null}
    </button>
  )
}

/** The sidebar head: the Mac / Cloud switcher, then Home, Create and Search, over a divider. */
export function RevioSidebarNav(): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const setActiveView = useAppStore((s) => s.setActiveView)
  // A workspace being set up is on screen in place of Home; its own row is the selected one.
  const homeActive = useAppStore(
    (s) =>
      s.activeView === 'terminal' && !s.activeWorktreeId && !selectWorktreeCreationSurfaceShown(s)
  )
  // After Sleep the workspace's asleep screen is on screen in place of Home.
  const asleepViewId = useRevioAsleepViewId()
  const dashboardEnabled = useAppStore((s) => s.settings?.experimentalAgentDashboardPopout === true)
  const createCombo = useShortcutKeyComboDetails('workspace.create')[0]
  const searchCombo = useShortcutKeyComboDetails('worktree.palette')[0]
  return (
    <div
      className="mb-1 flex flex-col gap-0.5 border-b border-worktree-sidebar-border px-1.5 pt-0 pb-2"
      data-contextual-tour-target="sidebar-navigation"
    >
      <RevioLocationSwitcher />
      <NavRow
        icon={Home}
        label={translate('auto.components.revioLayout.home', 'Home')}
        active={homeActive && asleepViewId === null}
        onClick={() => {
          clearRevioAsleepView()
          setActiveView('terminal')
          setActiveWorktree(null)
          useAppStore.getState().setActivePendingWorktreeCreation(null)
        }}
      />
      <NavRow
        icon={Plus}
        label={translate('auto.components.revioLayout.create', 'Create')}
        combo={createCombo}
        onClick={openWorkspaceCreationComposerWithTourHandoff}
      />
      <NavRow
        icon={Search}
        label={translate('auto.components.sidebar.SidebarNav.80611a8b10', 'Search')}
        combo={searchCombo}
        onClick={() => openModal('worktree-palette')}
      />
      {dashboardEnabled ? (
        <NavRow
          icon={LayoutDashboard}
          label={translate('auto.components.revioLayout.dashboard', 'Dashboard')}
          onClick={() => {
            useAppStore.getState().setSidebarOpen(true)
            window.dispatchEvent(new CustomEvent(TOGGLE_WORKSPACE_BOARD_EVENT))
          }}
        />
      ) : null}
    </div>
  )
}
