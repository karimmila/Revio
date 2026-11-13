import { afterAll, describe, expect, it, vi } from 'vitest'
import type * as PostHogTransport from './posthog-transport'
import { BASE_COMMON, makeFakeSettings, makeFakeStore } from './client-test-harness'

const { createPostHogClient } = vi.hoisted(() => {
  // A CI-style identity and key without a fork-identity key must still never transmit.
  Object.assign(globalThis, { ORCA_BUILD_IDENTITY: 'stable', ORCA_POSTHOG_WRITE_KEY: 'phc_x' })
  return { createPostHogClient: vi.fn() }
})
vi.mock('./posthog-transport', async (importOriginal) => ({
  ...(await importOriginal<typeof PostHogTransport>()),
  createPostHogClient
}))

const { initTelemetry, isTelemetryEnabled, track } = await import('./client')

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'ORCA_BUILD_IDENTITY')
  Reflect.deleteProperty(globalThis, 'ORCA_POSTHOG_WRITE_KEY')
})

describe('telemetry without a fork-identity write key', () => {
  it('never starts a client or accepts an event', () => {
    const scheduleStart = vi.fn()
    const store = makeFakeStore(
      makeFakeSettings({
        optedIn: true,
        installId: BASE_COMMON.install_id,
        existedBeforeTelemetryRelease: false
      })
    )
    initTelemetry(store, scheduleStart)

    expect(scheduleStart).not.toHaveBeenCalled()
    expect(isTelemetryEnabled()).toBe(false)
    expect(track('app_opened', {} as never)).toBe(false)
    expect(createPostHogClient).not.toHaveBeenCalled()
  })
})
