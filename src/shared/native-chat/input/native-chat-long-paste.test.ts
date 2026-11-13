import { expect, it } from 'vitest'
import {
  REVIO_PASTED_TEXT_CHARACTER_THRESHOLD,
  isNativeChatLongPaste
} from './native-chat-long-paste'

it('converts pastes over 5000 characters in the workspace layout; Orca waits for 32 KB', () => {
  const text = 'x'.repeat(5001)
  expect(isNativeChatLongPaste(text)).toBe(false)
  expect(isNativeChatLongPaste(text, REVIO_PASTED_TEXT_CHARACTER_THRESHOLD)).toBe(true)
  expect(isNativeChatLongPaste('x'.repeat(5000), REVIO_PASTED_TEXT_CHARACTER_THRESHOLD)).toBe(false)
})
