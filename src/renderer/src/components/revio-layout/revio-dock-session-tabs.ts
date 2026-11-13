/**
 * Dock tabs started in this app session. sessionStorage survives a renderer reload, when a live
 * ssh line keeps running, but not a restart, when a restored dock tab comes back as a plain shell
 * on this Mac in the home folder (seen 2026-11-10: a cloud workspace's Run tab said `mac.lan`).
 */
const LIVE_STORAGE_KEY = 'orca.revioDockLiveTabs'

export function readLiveTabs(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(LIVE_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

const INTERACTIVE_STORAGE_KEY = 'orca.revioDockInteractiveTabs'

function readInteractiveTabs(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(INTERACTIVE_STORAGE_KEY) ?? '[]'
    )
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

/**
 * A remote workspace's numbered dock terminal is a shell the person types into; its Setup and
 * Run tabs are logs. The OSC 52 policy tells them apart with this.
 */
export function isInteractiveDockTab(tabId: string): boolean {
  return readInteractiveTabs().has(tabId)
}

export function markDockTabInteractive(tabId: string): void {
  const interactive = readInteractiveTabs()
  interactive.add(tabId)
  try {
    window.sessionStorage.setItem(INTERACTIVE_STORAGE_KEY, JSON.stringify([...interactive]))
  } catch {
    // Without storage the tab counts as a log, which only refuses its terminal copies.
  }
}

export function markDockTabLive(tabId: string): void {
  const live = readLiveTabs()
  live.add(tabId)
  try {
    window.sessionStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify([...live]))
  } catch {
    // Without storage a restart sweeps nothing extra; the tab still works this session.
  }
}
