import type React from 'react'
import { translate } from '@/i18n/i18n'
import { useRevioLayout } from '@/components/revio-layout/revio-layout'
import {
  diffChangeSignature,
  toggleDiffFileViewed,
  useDiffFileViewed
} from '@/lib/diff-viewed-store'

/**
 * "Viewed" box on a diff file: checking it folds the file away, and a later change to
 * the file clears it. ⌃V does the same for the file in view.
 */
export function DiffViewedToggle({
  worktreeId,
  path,
  added,
  removed,
  collapsed,
  onCollapse
}: {
  worktreeId: string
  path: string
  added: number
  removed: number
  collapsed: boolean
  onCollapse: () => void
}): React.JSX.Element | null {
  const enabled = useRevioLayout()
  const signature = diffChangeSignature(added, removed)
  const viewed = useDiffFileViewed(worktreeId, path, signature)
  if (!enabled) {
    return null
  }
  return (
    <label
      className="mr-1 flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={viewed}
        data-diff-viewed-toggle=""
        onChange={() => {
          if (toggleDiffFileViewed(worktreeId, path, signature) && !collapsed) {
            onCollapse()
          }
        }}
        className="size-3 accent-current"
      />
      {translate('auto.components.editor.diffViewed', 'Viewed')}
    </label>
  )
}
