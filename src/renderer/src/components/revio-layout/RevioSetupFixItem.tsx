import type React from 'react'
import { CircleAlert } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useSetupStatus } from './revio-setup-status'
import { fixSetupWithAgent } from './revio-setup-fix'

export function setupFixLabel(): string {
  return translate('auto.components.revioLayout.setupFixIt', 'Setup script failed — fix it?')
}

/** The Run menu's "Setup script failed — fix it?", shown while the workspace's last setup failed. */
export function RevioSetupFixItem({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const path = useAppStore(
    (s) => findWorktreeById(selectWorktreesByRepo(s), worktreeId)?.path ?? ''
  )
  const status = useSetupStatus(path)
  if (status !== 'failed') {
    return null
  }
  return (
    <DropdownMenuItem variant="destructive" onSelect={() => void fixSetupWithAgent(worktreeId)}>
      <CircleAlert className="size-3.5" />
      {setupFixLabel()}
    </DropdownMenuItem>
  )
}
