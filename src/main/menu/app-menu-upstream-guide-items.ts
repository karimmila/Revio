/**
 * The "Explore" tour and "Getting Started" guide describe upstream features the workspace layout
 * does not ship (agent catalog, skills, remote hosts), so that layout's Help menu leaves them out.
 */
export function createUpstreamGuideMenuItems(args: {
  revioLayout: boolean
  hasFeatureWallTiles: boolean
  featureTourItem: Electron.MenuItemConstructorOptions
  setupGuideItem: Electron.MenuItemConstructorOptions
}): Electron.MenuItemConstructorOptions[] {
  if (args.revioLayout) {
    return []
  }
  return [...(args.hasFeatureWallTiles ? [args.featureTourItem] : []), args.setupGuideItem]
}
