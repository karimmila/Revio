import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { fetchActiveClaudeRateLimits } from './claude-active-usage-fetch'
import {
  fetchInactiveClaudeAccountUsage,
  type InactiveClaudeAccount
} from './claude-managed-account-usage'
import type {
  ClaudeManagedAccountUsageOptions,
  ClaudeRateLimitFetchOptions
} from './claude-usage-fetch-options'
import { isUsageMeterEnabled, usageMeterOffSnapshot } from './usage-meter-gate'

export type FetchClaudeRateLimitsOptions = ClaudeRateLimitFetchOptions
export type FetchManagedAccountUsageOptions = ClaudeManagedAccountUsageOptions
export type InactiveClaudeAccountInfo = InactiveClaudeAccount

export async function fetchClaudeRateLimits(
  options?: FetchClaudeRateLimitsOptions
): Promise<ProviderRateLimits> {
  if (!isUsageMeterEnabled('claude')) {
    return usageMeterOffSnapshot('claude')
  }
  return fetchActiveClaudeRateLimits(options)
}

export async function fetchManagedAccountUsage(
  account: InactiveClaudeAccountInfo,
  options: FetchManagedAccountUsageOptions = {}
): Promise<ProviderRateLimits> {
  return fetchInactiveClaudeAccountUsage(account, options)
}
