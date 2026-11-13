export type FeatureWallTileId =
  | 'tile-01'
  | 'tile-02'
  | 'tile-03'
  | 'tile-04'
  | 'tile-05'
  | 'tile-06'
  | 'tile-07'
  | 'tile-08'
  | 'tile-09'
  | 'tile-10'
  | 'tile-11'
  | 'tile-12'

type FeatureWallTileBase = {
  id: FeatureWallTileId
  title: string
  caption: string
  owner: string
  docsUrl: string
}

export type FeatureWallTile =
  | (FeatureWallTileBase & {
      kind: 'media'
      gifPath: string
      posterPath: string
      recordedAtPath: string
    })
  | (FeatureWallTileBase & {
      kind: 'agent-status-mockup'
    })

export const FEATURE_WALL_MEDIA_TILE_IDS = [
  'tile-01',
  'tile-02',
  'tile-03',
  'tile-04',
  'tile-05',
  'tile-06',
  'tile-07',
  'tile-08',
  'tile-09',
  'tile-10',
  'tile-11',
  'tile-12'
] as const satisfies readonly FeatureWallTileId[]

export type FeatureWallMediaTileId = (typeof FEATURE_WALL_MEDIA_TILE_IDS)[number]

export type FeatureWallMediaTile = Extract<FeatureWallTile, { kind: 'media' }>

export function isFeatureWallMediaTile(tile: FeatureWallTile): tile is FeatureWallMediaTile {
  return tile.kind === 'media'
}

// The upstream tour recordings showed upstream branding, so they were removed and no tiles ship.
// With zero tiles the Help > Explore item and the tour modal stay hidden; adding a media tile
// (plus its files in resources/onboarding/feature-wall) brings both back.
export const FEATURE_WALL_TILES: readonly FeatureWallTile[] = []

export const HAS_FEATURE_WALL_TILES = FEATURE_WALL_TILES.length > 0
