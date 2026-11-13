import React from 'react'
import { translate } from '@/i18n/i18n'
import { applyUIZoom } from '@/lib/ui-zoom'
import {
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_STEP,
  zoomLevelToPercent
} from '../../../../../shared/ui-zoom-level'
import { RevioSelect } from './RevioSettingsRows'

const LEVELS: readonly number[] = Array.from(
  { length: Math.round((UI_ZOOM_MAX - UI_ZOOM_MIN) / UI_ZOOM_STEP) + 1 },
  (_, index) => UI_ZOOM_MIN + index * UI_ZOOM_STEP
)

/** The zoom dropdown over Orca's zoom steps; ⌘+ and ⌘− keep it current. */
export function RevioZoomControl(): React.JSX.Element {
  const [level, setLevel] = React.useState(() => window.api.ui.getZoomLevel())
  React.useEffect(
    () => window.api.ui.onTerminalZoom(() => setLevel(window.api.ui.getZoomLevel())),
    []
  )
  return (
    <RevioSelect
      label={translate('auto.components.revioLayout.settings.zoom', 'App zoom')}
      value={String(level)}
      options={LEVELS.map((step) => ({
        value: String(step),
        label: `${zoomLevelToPercent(step)}%`
      }))}
      onChange={(value) => {
        const next = Number(value)
        applyUIZoom(next)
        setLevel(next)
        window.api.ui.set({ uiZoomLevel: next })
      }}
    />
  )
}
