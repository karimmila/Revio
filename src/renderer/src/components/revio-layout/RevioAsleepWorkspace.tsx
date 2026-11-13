import type React from 'react'
import { Moon } from 'lucide-react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { translate } from '@/i18n/i18n'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { refreshAsleepCloudEnvironmentsSoon } from '@/lib/cloud-asleep-environments'

/**
 * What the center shows after Sleep, in place of Home: the workspace is still the one selected,
 * and Wake opens it again (which resumes its sandbox and its chats).
 */
export default function RevioAsleepWorkspace({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element {
  const name = useAppStore(
    (s) => findWorktreeById(selectWorktreesByRepo(s), worktreeId)?.displayName ?? ''
  )
  return (
    <div
      data-revio-asleep-workspace=""
      className="flex h-full min-h-0 w-full flex-col bg-background"
    >
      <header className="titlebar bg-background! pr-2 pl-4">
        <span className="min-w-0 truncate text-[13px] text-foreground/80">{name}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Moon className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-foreground">
          {translate('auto.components.revioLayout.asleepTitle', 'This workspace is asleep')}
        </p>
        <p className="max-w-sm text-[12px] text-muted-foreground">
          {translate(
            'auto.components.revioLayout.asleepBody',
            'Its sandbox is stopped. Your files and chats are kept, and waking it takes a few seconds.'
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            refreshAsleepCloudEnvironmentsSoon()
            void activateWorktreeFromSidebar(worktreeId)
          }}
          className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[13px] text-foreground transition-colors hover:bg-accent"
        >
          {translate('auto.components.revioLayout.wake', 'Wake')}
        </button>
      </div>
    </div>
  )
}
