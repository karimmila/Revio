import { describe, expect, it } from 'vitest'
import { createUpstreamGuideMenuItems } from './app-menu-upstream-guide-items'

const featureTourItem = { label: 'Explore' }
const setupGuideItem = { label: 'Getting Started' }

describe('Help menu guide items', () => {
  it('offers no upstream tour or guide in the workspace layout', () => {
    expect(
      createUpstreamGuideMenuItems({
        revioLayout: true,
        hasFeatureWallTiles: true,
        featureTourItem,
        setupGuideItem
      })
    ).toEqual([])
  })

  it('keeps both in the classic layout', () => {
    expect(
      createUpstreamGuideMenuItems({
        revioLayout: false,
        hasFeatureWallTiles: true,
        featureTourItem,
        setupGuideItem
      })
    ).toEqual([featureTourItem, setupGuideItem])
  })
})
