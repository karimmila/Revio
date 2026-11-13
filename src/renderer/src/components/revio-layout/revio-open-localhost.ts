import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { expandPreviewUrl } from '../../../../shared/actions/preview-urls'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import {
  openWorkspacePortInBrowser,
  scanWorkspacePortsForTarget,
  shouldOpenWorkspacePortInOrcaBrowser
} from '@/lib/workspace-ports/workspace-port-actions'

/** The port ⌘⇧B opens: the workspace's own listener, an HTTP(S) one first, lowest port first. */
export function workspaceLocalhostPort(
  ports: readonly WorkspacePort[],
  worktreeId: string
): WorkspacePort | null {
  const own = ports.filter(
    (port) => port.kind === 'workspace' && port.owner.worktreeId === worktreeId
  )
  const rank = (port: WorkspacePort): number => (port.protocol === 'unknown' ? 1 : 0)
  return [...own].sort((a, b) => rank(a) - rank(b) || a.port - b.port)[0] ?? null
}

/**
 * ⌘⇧B "Open localhost URL": the dev server this workspace runs, in a browser tab of
 * the workspace (or the system browser when links open outside Orca). Workspaces on this Mac only.
 */
export async function openRevioLocalhost(worktreeId: string): Promise<void> {
  const preview = (await workspacePreviewUrls(worktreeId))[0]
  if (preview) {
    openPreviewUrl(worktreeId, preview)
    return
  }
  const target: RuntimeClientTarget = { kind: 'local' }
  let port: WorkspacePort | null = null
  try {
    port = workspaceLocalhostPort((await scanWorkspacePortsForTarget(target)).ports, worktreeId)
  } catch {
    port = null
  }
  if (!port) {
    toast.message(
      translate(
        'auto.components.revioLayout.noLocalhost',
        'No localhost URL found. Start the dev server with Run (⌘R).'
      )
    )
    return
  }
  const state = useAppStore.getState()
  const result = await openWorkspacePortInBrowser({
    port,
    activeWorktreeId: worktreeId,
    runtimeTarget: target,
    createBrowserTab: state.createBrowserTab,
    setRemoteBrowserPageHandle: state.setRemoteBrowserPageHandle,
    openInOrcaBrowser: previewOpensInApp(state.settings)
  })
  if (!result.ok) {
    toast.error(result.reason)
  }
}

/** The repository's Preview URLs with this workspace's port filled in (Settings, Actions). */
export async function workspacePreviewUrls(worktreeId: string): Promise<string[]> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const api = window.api.repoActions
  if (!worktree || !api) {
    return []
  }
  const listed = await api.list(worktree.repoId).catch(() => null)
  if (!listed || listed.previewUrls.length === 0) {
    return []
  }
  const env = await api.scriptEnv(worktree.repoId, worktree.path).catch(() => null)
  const port = Number(env?.ORCA_PORT)
  return Number.isFinite(port) && port > 0
    ? listed.previewUrls.map((url) => expandPreviewUrl(url, port))
    : listed.previewUrls
}

/** Orca's "open links in Orca", or the experimental "In-app browser preview". */
export function previewOpensInApp(
  settings: { openLinksInApp?: boolean; revioInAppBrowserPreview?: boolean } | null | undefined
): boolean {
  return (
    shouldOpenWorkspacePortInOrcaBrowser(settings) || settings?.revioInAppBrowserPreview === true
  )
}

/** A preview URL opens in a browser tab of the workspace, or the system browser per settings. */
export function openPreviewUrl(worktreeId: string, url: string): void {
  const state = useAppStore.getState()
  if (previewOpensInApp(state.settings)) {
    state.createBrowserTab(worktreeId, url, { activate: true })
    return
  }
  void window.api.shell.openUrl(url)
}
