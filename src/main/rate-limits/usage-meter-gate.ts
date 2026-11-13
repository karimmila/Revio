import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import type { UsageMeterProvider } from '../../shared/usage-meter-providers'

type UsageMeterEnabledResolver = (provider: UsageMeterProvider) => boolean

let enabledResolver: UsageMeterEnabledResolver | null = null

/**
 * Decides which providers' usage may be read. A new profile has none, so the app makes no usage
 * request and reads no other tool's credentials (some sit in the macOS Keychain and would prompt)
 * until an agent of that provider runs here. With no resolver, every provider is on.
 */
export function setUsageMeterEnabledResolver(resolver: UsageMeterEnabledResolver | null): void {
  enabledResolver = resolver
}

export function isUsageMeterEnabled(provider: UsageMeterProvider): boolean {
  return enabledResolver?.(provider) ?? true
}

/** A settled "nothing to show" reading, so a gated meter never looks like one still loading. */
export function usageMeterOffSnapshot(
  provider: UsageMeterProvider,
  now: number = Date.now()
): ProviderRateLimits {
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: now,
    error: null,
    status: 'unavailable'
  }
}
