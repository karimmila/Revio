import { parseExecutionHostId, type ExecutionHostId } from '../../../shared/execution-host'
import type { FolderWorkspace } from '../../../shared/folder-workspaces/folder-workspace-types'
import type { Worktree } from '../../../shared/worktree/types'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'
import '../lib/workspace/ownership/worktree-runtime-owner-index'
import { getCatalogOwnerHostId } from '../lib/workspace/ownership/workspace-catalog-owner-index'

export type WorkspaceSurface = { id: string; path: string }

type FolderWorkspaceSurfaceRow = Pick<
  FolderWorkspace,
  'id' | 'folderPath' | 'connectionId' | 'executionHostId'
>

/** Only explicitly named hosts may win collisions; default-local owner lookup would let unstamped rows mount another host’s path. */
function getStampedFolderWorkspaceHostId(
  workspace: FolderWorkspaceSurfaceRow
): ExecutionHostId | null {
  const namesOwnHost = Boolean(
    parseExecutionHostId(workspace.executionHostId) ?? workspace.connectionId?.trim()
  )
  return namesOwnHost ? getCatalogOwnerHostId(workspace) : null
}

/** Workbench state/keys support one surface per bare workspace ID, unlike host-qualified listing catalogs (STA-4343). Collapse only here; Git IDs encode repo/path so first-wins is lossless. */
export function projectWorkspaceSurfaces({
  worktreesById,
  folderWorkspaces,
  activeWorkspaceId,
  activeWorkspaceResolvedHostId
}: {
  worktreesById: ReadonlyMap<string, Pick<Worktree, 'path'>>
  folderWorkspaces: readonly FolderWorkspaceSurfaceRow[]
  /** Read only when `activeWorkspaceResolvedHostId` is set; inert otherwise. */
  activeWorkspaceId: string | null
  /** Resolved (not user-selected) host of the active workspace; the folder tie-break. */
  activeWorkspaceResolvedHostId: ExecutionHostId | null
}): WorkspaceSurface[] {
  const surfaces: WorkspaceSurface[] = []
  for (const [worktreeId, worktree] of worktreesById) {
    surfaces.push({ id: worktreeId, path: worktree.path })
  }
  const folderSurfaceIndexById = new Map<string, number>()
  for (const workspace of folderWorkspaces) {
    const id = folderWorkspaceKey(workspace.id)
    const surface = { id, path: workspace.folderPath }
    const existingIndex = folderSurfaceIndexById.get(id)
    if (existingIndex === undefined) {
      folderSurfaceIndexById.set(id, surfaces.length)
      surfaces.push(surface)
      continue
    }
    // Opaque folder IDs can collide across paths; use the active resolved host, requiring explicit row host identity, otherwise retain first-wins.
    if (
      activeWorkspaceResolvedHostId &&
      id === activeWorkspaceId &&
      getStampedFolderWorkspaceHostId(workspace) === activeWorkspaceResolvedHostId
    ) {
      surfaces[existingIndex] = surface
    } else if (surfaces[existingIndex].path !== surface.path) {
      // Report unresolved path drops: that path becomes PTY cwd when no startupCwd exists.
      console.warn('[workspace-surface] dropping colliding folder path', {
        id,
        kept: surfaces[existingIndex].path,
        dropped: surface.path,
        droppedHost: getCatalogOwnerHostId(workspace)
      })
    }
  }
  return surfaces
}

/**
 * Keeps each surface where it first appeared and adds new ones at the end. The catalog's own
 * order can change under mounted surfaces (git lists worktrees by name, so a new
 * "add-…" workspace lands before older ones once the list refreshes). A keyed reorder moves the
 * older surfaces, and React's development StrictMode then disconnects and reconnects every effect
 * in a moved subtree: @monaco-editor/react disposes its diff editor on the disconnect and calls
 * setModel on the disposed editor on the reconnect, which crashed the terminal workbench
 * ("InstantiationService has been disposed", seen 2026-11-11 when creating a workspace).
 */
export function keepWorkspaceSurfaceOrder(
  previousIds: readonly string[],
  surfaces: readonly WorkspaceSurface[]
): WorkspaceSurface[] {
  const rank = new Map(previousIds.map((id, index) => [id, index]))
  const kept = surfaces.filter((surface) => rank.has(surface.id))
  kept.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  return [...kept, ...surfaces.filter((surface) => !rank.has(surface.id))]
}
