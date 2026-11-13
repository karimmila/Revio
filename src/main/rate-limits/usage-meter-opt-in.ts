import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  isUsageMeterProviderEnabled,
  usageMeterProviderForAgent,
  type UsageMeterProvider
} from '../../shared/usage-meter-providers'
import { setUsageMeterEnabledResolver } from './usage-meter-gate'

type AgentStatusEvent = {
  /** A cached row sent again, not an agent doing something now. */
  isReplay?: boolean
  restoredUnconfirmed?: true
  payload: { agentType?: string }
}

export type UsageMeterOptInDeps = {
  /** userData/usage-meter-providers.json: the providers whose agents have run in this profile. */
  filePath: string
  statusSource: { subscribeEnrichedStatus(listener: (event: AgentStatusEvent) => void): () => void }
  managedAccountCounts: () => { claude: number; codex: number }
  /** Called once when a provider's first agent runs, so its meter fills without a restart. */
  onProviderEnabled: (provider: UsageMeterProvider) => void
}

function readUsedProviders(filePath: string): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : []
  } catch {
    // A missing or unreadable file means a new profile: nothing is on.
    return []
  }
}

/**
 * Turns a provider's usage meter on the first time one of its agents runs in this app, and keeps
 * that across restarts. Until then the meter makes no request and reads no credentials.
 */
export function installUsageMeterOptIn(deps: UsageMeterOptInDeps): () => void {
  const used = new Set(readUsedProviders(deps.filePath))
  setUsageMeterEnabledResolver((provider) => {
    const accounts = deps.managedAccountCounts()
    return isUsageMeterProviderEnabled(provider, {
      usedProviders: [...used],
      claudeManagedAccounts: accounts.claude,
      codexManagedAccounts: accounts.codex
    })
  })
  const unsubscribe = deps.statusSource.subscribeEnrichedStatus((event) => {
    if (event.isReplay || event.restoredUnconfirmed) {
      return
    }
    const provider = usageMeterProviderForAgent(event.payload.agentType)
    if (!provider || used.has(provider)) {
      return
    }
    used.add(provider)
    try {
      mkdirSync(dirname(deps.filePath), { recursive: true })
      writeFileSync(deps.filePath, `${JSON.stringify([...used].sort(), null, 2)}\n`, 'utf8')
    } catch (error) {
      // The meter still works for this run; it asks again after a restart.
      console.warn('[rate-limits] could not save the usage meter list:', error)
    }
    deps.onProviderEnabled(provider)
  })
  return () => {
    unsubscribe()
    setUsageMeterEnabledResolver(null)
  }
}
