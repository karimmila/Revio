import { describe, expect, it } from 'vitest'
import { normalizeNotificationSettings } from './onboarding-normalization'

describe('notification sound normalization', () => {
  it('keeps "No sound" through a settings load', () => {
    expect(normalizeNotificationSettings({ customSoundId: 'none' }).customSoundId).toBe('none')
  })
})
