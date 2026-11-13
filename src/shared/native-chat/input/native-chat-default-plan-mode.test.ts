import { describe, expect, it } from 'vitest'
import { structuredLaunchSeedOptions } from './native-chat-session-option-defaults'

describe('Default plan mode', () => {
  it('starts new Claude and Codex chats in plan mode when the setting is on', () => {
    const settings = { revioDefaultPlanMode: true }
    expect(structuredLaunchSeedOptions(settings, 'claude')?.interactionMode).toBe('plan')
    expect(structuredLaunchSeedOptions(settings, 'codex')?.interactionMode).toBe('plan')
  })

  it('leaves agents without a plan mode, and the setting off, alone', () => {
    expect(
      structuredLaunchSeedOptions({ revioDefaultPlanMode: true }, 'gemini')?.interactionMode
    ).toBeUndefined()
    expect(structuredLaunchSeedOptions({}, 'claude')?.interactionMode).toBeUndefined()
    expect(
      structuredLaunchSeedOptions({ revioDefaultPlanMode: true, revioLayout: false }, 'claude')
        ?.interactionMode
    ).toBeUndefined()
  })
})
