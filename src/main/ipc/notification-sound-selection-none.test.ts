import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getAppPath: () => '/app', isPackaged: false } }))

import { getSelectedNotificationSoundPath } from './notification-sound-selection'
import { getDefaultNotificationSettings } from '../../shared/notification-settings-defaults'

describe('No sound', () => {
  it('selects no file to play', () => {
    expect(
      getSelectedNotificationSoundPath({ ...getDefaultNotificationSettings(), customSoundId: 'none' })
        .path
    ).toBeNull()
  })
})
