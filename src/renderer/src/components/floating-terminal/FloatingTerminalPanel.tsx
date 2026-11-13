import { renderFloatingTerminalPanelSurface } from './FloatingTerminalPanelSurface'
import type { FloatingTerminalPanelProps } from './floating-terminal-panel-types'
import { useFloatingTerminalPanelController } from './use-floating-terminal-panel-controller'
import { useRevioLayout } from '@/components/revio-layout/revio-layout'
import { useRevioTerminalDockRect } from '@/components/revio-layout/RevioTerminalDock'

export { FloatingTerminalToggleButton } from './FloatingTerminalToggleButton'

const noop = (): void => {}

export function FloatingTerminalPanel(props: FloatingTerminalPanelProps): React.JSX.Element {
  const surface = useFloatingTerminalPanelController(props)
  const revioLayout = useRevioLayout()
  const dock = useRevioTerminalDockRect()
  if (!revioLayout) {
    return renderFloatingTerminalPanelSurface(surface)
  }
  // The workspace layout shows the terminal only in the right column's dock; elsewhere it stays
  // mounted, hidden.
  if (!dock) {
    return renderFloatingTerminalPanelSurface({ ...surface, open: false })
  }
  return renderFloatingTerminalPanelSurface({
    ...surface,
    docked: true,
    // Orchestration is not part of the workspace layout, so its setup card never shows here.
    showOrchestrationSetup: false,
    // Treating the dock as maximized hides resize handles and skips saving floating bounds.
    maximized: true,
    bounds: { ...surface.bounds, ...dock },
    handleDragStart: noop,
    handleDragMove: noop,
    handleDragEnd: noop,
    handleTitlebarDoubleClick: noop
  })
}
