import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Home, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { withoutWorkspaceTab, withVisitedWorkspace } from './revio-workspace-tabs'

const NO_DRAG = '[-webkit-app-region:no-drag]'

/**
 * The workspace tabs bar (its internal "workspace tabs" flag): a fixed Home tab, then the
 * workspaces visited this session, browser style. Experimental and off by default.
 */
export function RevioWorkspaceTabs(): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) =>
    s.activeView === 'terminal' ? s.activeWorktreeId : null
  )
  const [tabs, setTabs] = React.useState<string[]>([])
  React.useEffect(() => {
    setTabs((current) => withVisitedWorkspace(current, activeWorktreeId))
  }, [activeWorktreeId])
  const names = useAppStore(
    useShallow((s) =>
      tabs.map((id) => findWorktreeById(selectWorktreesByRepo(s), id)?.displayName ?? null)
    )
  )
  const exists = (id: string): boolean => names[tabs.indexOf(id)] !== null
  const home = useAppStore((s) => s.activeView === 'terminal' && !s.activeWorktreeId)
  return (
    <div
      data-revio-workspace-tabs=""
      className="flex h-8 min-w-0 items-end gap-0.5 overflow-hidden px-2"
    >
      <button
        type="button"
        aria-label={translate('auto.components.revioLayout.home', 'Home')}
        data-active={home ? 'true' : undefined}
        className={cn('flex h-7 shrink-0 items-center rounded-t-md px-2', NO_DRAG)}
        onClick={() => {
          const state = useAppStore.getState()
          state.setActiveView('terminal')
          state.setActiveWorktree(null)
        }}
      >
        <Home className="size-3.5" />
      </button>
      {tabs.filter(exists).map((id) => {
        const name = names[tabs.indexOf(id)]
        return (
          <div
            key={id}
            data-active={id === activeWorktreeId ? 'true' : undefined}
            className={cn(
              'group flex h-7 min-w-0 max-w-48 items-center gap-1 rounded-t-md pl-2.5 pr-1',
              NO_DRAG
            )}
          >
            <button
              type="button"
              className="min-w-0 truncate text-left text-[12px]"
              onClick={() => activateAndRevealWorktree(id, { sidebarRevealBehavior: 'auto' })}
            >
              {name ?? id}
            </button>
            <button
              type="button"
              aria-label={translate('auto.components.revioLayout.closeWorkspaceTab', 'Close tab')}
              className="opacity-0 group-hover:opacity-100"
              onClick={() => setTabs((current) => withoutWorkspaceTab(current, id, exists))}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
