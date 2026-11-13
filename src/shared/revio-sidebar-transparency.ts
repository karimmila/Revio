import type { WindowMaterial } from './window-material'

type TransparencySettings = {
  revioSidebarTransparency?: boolean
  revioSidebarTransparencyPriorMaterial?: WindowMaterial
  windowMaterial?: WindowMaterial
}

/**
 * The settings change for the "Sidebar transparency". Vibrancy needs a window material, so
 * turning it on with none switches to Blur and remembers the material it replaced; turning it off
 * puts that material back. A material the person picked themselves is left alone.
 */
export function sidebarTransparencyUpdate(
  checked: boolean,
  settings: TransparencySettings
): Partial<TransparencySettings> {
  const material = settings.windowMaterial ?? 'off'
  if (checked) {
    return material === 'off'
      ? {
          revioSidebarTransparency: true,
          windowMaterial: 'blur',
          revioSidebarTransparencyPriorMaterial: material
        }
      : { revioSidebarTransparency: true }
  }
  const prior = settings.revioSidebarTransparencyPriorMaterial
  return prior !== undefined && material === 'blur'
    ? {
        revioSidebarTransparency: false,
        windowMaterial: prior,
        revioSidebarTransparencyPriorMaterial: undefined
      }
    : { revioSidebarTransparency: false, revioSidebarTransparencyPriorMaterial: undefined }
}
