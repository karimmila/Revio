import type { ActivityBarItem } from './activity-bar-buttons'

type RightSidebarActivityVisibilityState = {
  isFolder: boolean
  isFolderWorkspace: boolean
  /** The workspace runs on an SSH host, reached directly or through its managed server. */
  hasSshHost: boolean
  isCloud?: boolean
  showArtifacts?: boolean
}

export function getVisibleRightSidebarActivityItems(
  items: ActivityBarItem[],
  {
    isFolder,
    isFolderWorkspace,
    hasSshHost,
    isCloud = false,
    showArtifacts = false
  }: RightSidebarActivityVisibilityState
): ActivityBarItem[] {
  return items.filter(
    (item) =>
      (!item.gitOnly || !isFolder) &&
      (!item.folderOnly || isFolderWorkspace) &&
      (!item.sshOnly || hasSshHost) &&
      (!item.cloudOnly || isCloud) &&
      (!item.artifactsOnly || showArtifacts)
  )
}
