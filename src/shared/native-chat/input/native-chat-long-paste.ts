import { measureUtf8ByteLength } from '../../utf8-byte-limits'

export const NATIVE_CHAT_PASTED_TEXT_FILE_THRESHOLD = 32 * 1024

/** "Auto-convert long text": pasted text over 5000 characters becomes an attachment. */
export const REVIO_PASTED_TEXT_CHARACTER_THRESHOLD = 5000

/** A paste this long becomes a "Pasted text" file attachment instead of prompt text. */
export function isNativeChatLongPaste(text: string, characterThreshold?: number): boolean {
  if (characterThreshold !== undefined && text.length > characterThreshold) {
    return true
  }
  return (
    text.length >= NATIVE_CHAT_PASTED_TEXT_FILE_THRESHOLD ||
    measureUtf8ByteLength(text, { stopAfterBytes: NATIVE_CHAT_PASTED_TEXT_FILE_THRESHOLD - 1 })
      .exceededLimit
  )
}
