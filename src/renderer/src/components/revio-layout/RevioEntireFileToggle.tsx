import type React from 'react'
import { FileText } from 'lucide-react'
import { DropdownMenuCheckboxItem, DropdownMenuShortcut } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { revioLayoutActive } from './revio-root-flags'
import {
  setRevioDiffEditMode,
  setRevioDiffEntireFile,
  useRevioDiffEditMode,
  useRevioDiffEntireFile
} from './revio-diff-view-store'

const EDIT_FILE_SHORTCUT = '\u2318E'

function entireFileLabel(): string {
  return translate('auto.components.revioLayout.diff.entireFile', 'Entire file')
}

/** "Entire file" diff toggle for the all-changes toolbar; hidden outside the layout. */
export function RevioEntireFileButton(): React.JSX.Element | null {
  const entireFile = useRevioDiffEntireFile()
  if (!revioLayoutActive()) {
    return null
  }
  return (
    <button
      type="button"
      className={`inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-xs transition-colors hover:text-foreground ${
        entireFile ? 'bg-accent text-foreground' : 'text-muted-foreground'
      }`}
      onClick={() => setRevioDiffEntireFile(!entireFile)}
      aria-pressed={entireFile}
    >
      <FileText className="size-3.5" />
      {entireFileLabel()}
    </button>
  )
}

/** The same toggle as a checkbox row in a single-file diff's actions menu. */
export function RevioEntireFileMenuItem(): React.JSX.Element | null {
  const entireFile = useRevioDiffEntireFile()
  if (!revioLayoutActive()) {
    return null
  }
  return (
    <DropdownMenuCheckboxItem checked={entireFile} onCheckedChange={setRevioDiffEntireFile}>
      {entireFileLabel()}
    </DropdownMenuCheckboxItem>
  )
}

/** ⌘E "Edit file" in a single-file diff's actions menu (file edit mode). */
export function RevioEditModeMenuItem(): React.JSX.Element | null {
  const editMode = useRevioDiffEditMode()
  if (!revioLayoutActive()) {
    return null
  }
  return (
    <DropdownMenuCheckboxItem checked={editMode} onCheckedChange={setRevioDiffEditMode}>
      {translate('auto.components.revioLayout.diff.editFile', 'Edit file')}
      <DropdownMenuShortcut>{EDIT_FILE_SHORTCUT}</DropdownMenuShortcut>
    </DropdownMenuCheckboxItem>
  )
}
