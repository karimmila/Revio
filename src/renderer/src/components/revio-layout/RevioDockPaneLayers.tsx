import type React from 'react'
import { WorkspacePaneOverlayLayers } from '@/components/WorkspacePaneOverlayLayers'
import { useRevioDockMountTabIds } from './revio-dock-orphans'

/**
 * The floating workspace's panes. In the workspace layout it is the dock, which holds every
 * workspace's terminals; only those of workspaces the person has opened mount, so the rest start
 * no shell (see `dockMountTabIds`).
 */
export function RevioDockPaneLayers(
  props: Omit<React.ComponentProps<typeof WorkspacePaneOverlayLayers>, 'backgroundMountTabIds'>
): React.JSX.Element {
  const backgroundMountTabIds = useRevioDockMountTabIds()
  return <WorkspacePaneOverlayLayers {...props} backgroundMountTabIds={backgroundMountTabIds} />
}
