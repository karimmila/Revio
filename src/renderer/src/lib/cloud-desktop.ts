import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { parseExecutionHostId } from '../../../shared/execution-host'
import { cloudEnvironmentIdsNow } from '@/lib/cloud-workspaces'

const DESKTOP_REMOTE_PORT = 6080
const DESKTOP_URL_PREFIX = `http://127.0.0.1:${DESKTOP_REMOTE_PORT}/vnc.html`

/** The cloud desktop's tab keeps its name; noVNC would otherwise retitle it "user@host - noVNC". */
export function isCloudDesktopUrl(url: string): boolean {
  return url.startsWith(DESKTOP_URL_PREFIX)
}

/** The cloud workspace's environment id, or null when the workspace is not on a sandbox. */
export function cloudEnvironmentIdOf(worktreeId: string): string | null {
  const state = useAppStore.getState()
  const repoId = worktreeId.split('::')[0]
  const repo = state.repos.find((candidate) => candidate.id === repoId)
  const host = parseExecutionHostId(repo?.executionHostId)
  return host?.kind === 'runtime' && cloudEnvironmentIdsNow().has(host.environmentId)
    ? host.environmentId
    : null
}

// The VNC password of each started desktop, by its websocket. It stays in memory: the view that
// draws the desktop reads it here, so it never sits in a URL, a prop dump or storage.
const desktopPasswords = new Map<string, string>()

export function cloudDesktopPassword(wsUrl: string): string | undefined {
  return desktopPasswords.get(wsUrl)
}

/**
 * Starts the sandbox desktop (VNC, Chrome, noVNC on the sandbox's 127.0.0.1:6080) and forwards it
 * to a free port on this Mac, listed under Ports as "Desktop". Returns the VNC websocket on that
 * port.
 */
export async function startCloudDesktop(environmentId: string): Promise<string> {
  const api = window.api.cloud
  if (!api) {
    throw new Error('Cloud workspaces are not available in this window.')
  }
  const desktop = await api.startDesktop(environmentId)
  const forwards = await window.api.ssh.listPortForwards({ targetId: desktop.sshTargetId })
  let local = forwards.find((entry) => entry.remotePort === desktop.remotePort)?.localPort
  if (local === undefined) {
    await window.api.ssh.addPortForward({
      targetId: desktop.sshTargetId,
      localPort: desktop.suggestedLocalPort,
      remoteHost: '127.0.0.1',
      remotePort: desktop.remotePort,
      label: translate('auto.lib.cloudDesktop.title', 'Desktop')
    })
    local = desktop.suggestedLocalPort
  }
  await waitUntilServed(`http://127.0.0.1:${local}/`)
  // Only the VNC websocket comes from the sandbox; the client that draws it is Orca's own.
  const wsUrl = `ws://127.0.0.1:${local}/websockify`
  desktopPasswords.set(wsUrl, desktop.password)
  return wsUrl
}

/**
 * The forward's local listener comes up a moment after addPortForward returns. A frame that loads
 * first is refused, and Electron draws a refused frame as a blank white page that never retries
 * (seen on a new workspace's first Desktop open, and after an app restart).
 */
async function waitUntilServed(url: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store' })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

/**
 * The desktop used to open as a center browser tab; it is now the right panel's Desktop tab.
 * Saved sessions still hold the old tab, so the open workspace's ones close and the panel opens.
 */
export function useRetireCenterDesktopTabs(): void {
  const staleTabIds = useAppStore((s) =>
    s.activeWorktreeId
      ? (s.browserTabsByWorktree[s.activeWorktreeId] ?? [])
          .filter((tab) => isCloudDesktopUrl(tab.url))
          .map((tab) => tab.id)
          .join(',')
      : ''
  )
  React.useEffect(() => {
    if (!staleTabIds) {
      return
    }
    const state = useAppStore.getState()
    for (const id of staleTabIds.split(',')) {
      state.closeBrowserTab(id)
    }
    state.setRightSidebarTab('desktop')
  }, [staleTabIds])
}
