import type { RevioLayoutSettings } from './revio-layout-settings-types'

export type RenameWorkspaceWithBranchSettings = Partial<
  Pick<RevioLayoutSettings, 'revioLayout' | 'revioRenameWorkspaceWithBranch'>
>

/** "Rename workspace when branch is named"; off, only the branch takes the new name. */
export function renamesWorkspaceWithBranch(settings: RenameWorkspaceWithBranchSettings): boolean {
  return settings.revioLayout === false || settings.revioRenameWorkspaceWithBranch !== false
}
