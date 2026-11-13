import type React from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/**
 * "File changed on disk" bar for a file with unsaved edits: keep yours (the next save
 * replaces the disk copy) or discard them and load the disk copy.
 */
export function RevioDiskChangeBanner({
  onKeepMine,
  onDiscardEdits
}: {
  onKeepMine: () => void
  onDiscardEdits: () => void
}): React.JSX.Element {
  return (
    <div role="alert" className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 font-medium text-foreground">
            {translate('auto.components.revioLayout.fileChangedOnDisk', 'File changed on disk')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="xs" variant="outline" onClick={onDiscardEdits}>
            {translate('auto.components.revioLayout.discardMyEdits', 'Discard my edits')}
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={onKeepMine}>
            {translate('auto.components.revioLayout.keepMine', 'Keep mine')}
          </Button>
        </div>
      </div>
    </div>
  )
}
