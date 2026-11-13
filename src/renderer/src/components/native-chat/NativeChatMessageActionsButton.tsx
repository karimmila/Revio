import { MoreHorizontal } from 'lucide-react'
import { translate } from '@/i18n/i18n'

/** "Show message actions" (⋯) under an answer: opens the message's own right-click
 * menu (Copy message, Copy final message, Fork…) at the button. */
export function NativeChatMessageActionsButton(): React.JSX.Element {
  const label = translate('components.native-chat.showMessageActions', 'Show message actions')
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        event.currentTarget.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left,
            clientY: rect.bottom
          })
        )
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MoreHorizontal className="size-3.5" />
    </button>
  )
}
