/** The port scheme: the first workspace gets 55000, each new one the next block of ten. */
export const WORKSPACE_PORT_BASE = 55_000
export const WORKSPACE_PORT_BLOCK = 10

/**
 * Hands each workspace a block of ten ports, `ORCA_PORT` through `ORCA_PORT + 9`, in request order.
 * It lives in memory, so numbers may change after a restart; a block is never
 * reused while the app runs.
 */
export function createWorkspacePortAllocator(): (workspaceKey: string) => number {
  const ports = new Map<string, number>()
  return (workspaceKey) => {
    const existing = ports.get(workspaceKey)
    if (existing !== undefined) {
      return existing
    }
    const port = WORKSPACE_PORT_BASE + ports.size * WORKSPACE_PORT_BLOCK
    ports.set(workspaceKey, port)
    return port
  }
}

/** The target branch name scripts see, without its remote (`origin/main` → `main`). */
export function defaultBranchName(baseRef: string | undefined): string | null {
  const trimmed = baseRef?.trim().replace(/^refs\/(remotes\/|heads\/)?/, '')
  if (!trimmed) {
    return null
  }
  const slash = trimmed.indexOf('/')
  return slash > 0 && trimmed.startsWith('origin/') ? trimmed.slice(slash + 1) : trimmed
}
