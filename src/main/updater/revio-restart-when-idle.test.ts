import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRevioRestartWhenIdle } from './revio-restart-when-idle'

function deps(overrides: { isUpdaterEnabled?: () => boolean } = {}) {
  return {
    isUpdaterEnabled: overrides.isUpdaterEnabled ?? (() => true),
    getSettings: () => ({ revioLayout: true, revioRestartOnUpdate: true }),
    getUpdateState: () => 'downloaded',
    getWorkingAgentCount: () => 0,
    getSystemIdleSeconds: () => 600,
    isQuitting: () => false,
    quitAndInstall: vi.fn()
  }
}

describe('installRevioRestartWhenIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('installs a downloaded update once idle when the updater has a feed', () => {
    const d = deps()
    installRevioRestartWhenIdle(d)
    vi.advanceTimersByTime(60_000)
    expect(d.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('starts no timer and never installs when the build has no update feed', () => {
    const d = deps({ isUpdaterEnabled: () => false })
    installRevioRestartWhenIdle(d)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10 * 60_000)
    expect(d.quitAndInstall).not.toHaveBeenCalled()
  })
})
