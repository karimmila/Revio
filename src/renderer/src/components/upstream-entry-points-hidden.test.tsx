import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { FEATURE_WALL_TILES } from '../../../shared/feature-wall-tiles'
import { FEATURE_WALL_WORKFLOWS } from '../../../shared/feature-wall-workflows'

const storeState = vi.hoisted(() => ({
  fetchSettings: async () => undefined,
  settings: { telemetry: { existedBeforeTelemetryRelease: true, optedIn: null } }
}))
vi.mock('../store', () => ({
  useAppStore: (select: (state: typeof storeState) => unknown) => select(storeState)
}))
vi.mock('../store/index', () => ({
  useAppStore: (select: (state: typeof storeState) => unknown) => select(storeState)
}))

const { PRIVACY_URL } = await import('../lib/telemetry')
const { PrivacyPane } = await import('./settings/privacy/PrivacyPane')
const { TelemetryFirstLaunchSurface } = await import('./TelemetryFirstLaunchSurface')
const { RelatedFeatures } = await import('./feature-wall/FeatureWallPreview')
const { ThemeLookCarousel, THEME_PLUGINS_URL } = await import('./onboarding/ThemeLookCarousel')
const { PluginCatalogLayout } = await import('./plugins/list/PluginCatalogLayout')

// fork-identity.json names no docs site, plugin directory, analytics key or diagnostics endpoint.
describe('upstream entry points with no fork services', () => {
  it('has no docs links', () => {
    expect(PRIVACY_URL).toBeNull()
    expect(FEATURE_WALL_TILES.every((tile) => tile.docsUrl === null)).toBe(true)
    expect(FEATURE_WALL_WORKFLOWS.every((workflow) => workflow.docsUrl === null)).toBe(true)
    for (const workflow of FEATURE_WALL_WORKFLOWS) {
      expect(renderToStaticMarkup(<RelatedFeatures workflow={workflow} source="help_menu" />)).toBe(
        ''
      )
    }
  })

  it('hides the privacy policy link, the telemetry switch, diagnostics sending and the telemetry notice', () => {
    const markup = renderToStaticMarkup(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: PrivacyPane reads only settings.telemetry
      <PrivacyPane settings={{ telemetry: { optedIn: true } } as unknown as GlobalSettings} />
    )
    expect(markup).not.toContain('Privacy policy')
    expect(markup).not.toContain('Share anonymous usage data')
    expect(markup).not.toContain('role="switch"')
    expect(markup).not.toContain('Send app diagnostics')
    expect(renderToStaticMarkup(<TelemetryFirstLaunchSurface />)).toBe('')
  })

  it('hides the theme plugin directory and the empty Not installed tab', () => {
    expect(THEME_PLUGINS_URL).toBeNull()
    const carousel = renderToStaticMarkup(
      <ThemeLookCarousel
        looks={[]}
        selectedId={null}
        onPick={() => {}}
        ariaLabel="Looks"
        header={null}
      />
    )
    expect(carousel).not.toContain('More themes')
    const layout = (showAvailable?: boolean): string =>
      renderToStaticMarkup(
        <PluginCatalogLayout
          filter="all"
          onFilterChange={() => {}}
          search=""
          onSearchChange={() => {}}
          installedCount={0}
          updateCount={0}
          showAvailable={showAvailable}
        >
          {null}
        </PluginCatalogLayout>
      )
    expect(layout(false)).not.toContain('Not installed')
    expect(layout()).toContain('Not installed')
  })
})
