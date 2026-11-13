import { translate } from '@/i18n/i18n'

/** Claude Code refuses a turn whose image is over its 5 MB limit; the chat fails until it rewinds. */
export function isImageTooLargeFailure(...texts: readonly (string | null | undefined)[]): boolean {
  return texts.some(
    (text) => text !== null && text !== undefined && /image exceeds 5\s?mb/i.test(text)
  )
}

/** "Image too large" notice under that failure. */
export function NativeChatImageTooLargeNotice(): React.JSX.Element {
  return (
    <div data-native-chat-image-too-large className="space-y-1 pl-6">
      <p className="font-medium">
        {translate('components.native-chat.imageTooLarge.title', 'Image too large')}
      </p>
      <p className="text-chat-foreground">
        {translate(
          'components.native-chat.imageTooLarge.body',
          "Exceeds Claude Code's size limit (5MB). Rewind to an earlier message, or this chat will keep failing."
        )}
      </p>
    </div>
  )
}
