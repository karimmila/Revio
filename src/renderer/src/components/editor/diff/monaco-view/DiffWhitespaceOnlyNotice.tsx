import { useAppStore } from '@/store/index'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { differsOnlyInWhitespace } from '../../../../../../shared/diff-whitespace-only'

/**
 * "Only whitespace changes found": with whitespace hidden, a file whose edits are all
 * whitespace would look unchanged, so say so and offer to show them.
 */
export function DiffWhitespaceOnlyNotice({
  originalContent,
  modifiedContent
}: {
  originalContent: string
  modifiedContent: string
}): React.JSX.Element | null {
  const showWhitespace = useAppStore((s) => s.settings?.diffShowWhitespace === true)
  if (showWhitespace || !differsOnlyInWhitespace(originalContent, modifiedContent)) {
    return null
  }
  return (
    <div data-diff-whitespace-only="" role="status">
      <span>
        {translate('auto.components.editor.diff.whitespaceOnly', 'Only whitespace changes found')}
      </span>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => void useAppStore.getState().updateSettings({ diffShowWhitespace: true })}
      >
        {translate('auto.components.editor.diff.showWhitespace', 'Show whitespace changes')}
      </Button>
    </div>
  )
}
