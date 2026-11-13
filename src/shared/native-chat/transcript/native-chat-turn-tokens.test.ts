import { expect, it } from 'vitest'
import { formatNativeChatTurnTokens, nativeChatTurnTokens } from './native-chat-turn-tokens'

it('reads the token usage stored on a turn record', () => {
  expect(
    nativeChatTurnTokens({
      used: {
        kind: 'estimate',
        capturedAt: 1,
        usage: {
          inputTokens: 1200,
          outputTokens: 300,
          cacheReadInputTokens: 50_000,
          cacheCreationInputTokens: 900
        }
      }
    })
  ).toEqual({ input: 1200, output: 300, cacheRead: 50_000, cacheWrite: 900 })
  expect(nativeChatTurnTokens({ used: { kind: 'unknown', capturedAt: 1 } })).toBeNull()
  expect(formatNativeChatTurnTokens({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 })).toBe(
    'Input 1 · Output 2 · Cache read 3 · Cache write 4'
  )
})
