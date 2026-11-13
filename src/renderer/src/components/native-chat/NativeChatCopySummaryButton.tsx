import { NativeChatCopyButton } from './NativeChatCopyButton'
import { translate } from '@/i18n/i18n'

/** "Copy summary" on the compaction divider. */
export function NativeChatCopySummaryButton({ summary }: { summary: string }): React.JSX.Element {
  return (
    <NativeChatCopyButton
      text={summary}
      label={translate('components.native-chat.notices.copySummary', 'Copy summary')}
    />
  )
}
