import type { TelemetrySettings } from '../../shared/telemetry-settings-types'

/**
 * The telemetry settings with the person's own choice written in. Identity and cohort are kept
 * (only a broken migration omits the block). An opt-in the person gave is marked as confirmed, so
 * it survives the load-time reset of opt-ins an earlier build wrote without asking.
 */
export function telemetryWithOptIn(
  current: TelemetrySettings | undefined,
  optedIn: boolean
): TelemetrySettings {
  return {
    ...(current ?? { installId: '', existedBeforeTelemetryRelease: true }),
    optedIn,
    ...(optedIn ? { optInConfirmed: true as const } : {})
  }
}
