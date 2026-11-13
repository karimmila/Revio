import type { AgentSessionModelCatalogResult } from '../../../../shared/agent-session/agent-session-wire'

const STORAGE_KEY = 'orca.composerModelListings'

function isListing(value: unknown): value is AgentSessionModelCatalogResult {
  return (
    !!value &&
    typeof value === 'object' &&
    'origin' in value &&
    'models' in value &&
    Array.isArray(value.models)
  )
}

function readAll(): Record<string, unknown> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return stored && typeof stored === 'object' ? { ...stored } : {}
  } catch {
    return {}
  }
}

/**
 * This Mac's last model listing per agent, so the Create dialog's pill names the default model
 * ("Opus 5.5 Medium") from its first frame instead of "Model" while the listing is read again.
 */
export function cachedModelListing(agent: string): AgentSessionModelCatalogResult | null {
  const listing = readAll()[agent]
  return isListing(listing) ? listing : null
}

export function rememberModelListing(agent: string, listing: AgentSessionModelCatalogResult): void {
  if (!isListing(listing)) {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [agent]: listing }))
  } catch {
    // Without storage the pill names the model once the listing arrives.
  }
}
